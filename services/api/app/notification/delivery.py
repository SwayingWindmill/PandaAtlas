from __future__ import annotations

import hashlib
import json
from typing import Any, Literal
from uuid import UUID, uuid4, uuid5

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.notification.templates import NotificationTemplateRenderer
from app.notification.transport import (
    NotificationEmailTransport,
    NotificationTransportError,
    minimal_resend_webhook_payload,
)

DELIVERY_QUEUE = "notification_deliveries"
DELIVERY_DLQ = "notification_deliveries_dlq"
WEBHOOK_QUEUE = "notification_webhooks"
WEBHOOK_DLQ = "notification_webhooks_dlq"
_DELIVERY_NAMESPACE = UUID("62e71e7d-91d9-5f0b-a24d-24d242a8402f")


class NotificationWebhookConflictError(ValueError):
    """A provider event ID was reused with a different signed payload."""


class NotificationDeliveryJob(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal[1] = 1
    delivery_id: UUID
    source_event_id: UUID
    target_type: Literal["intent", "digest"]
    target_id: UUID
    correlation_id: UUID


class NotificationWebhookJob(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: Literal[1] = 1
    provider: Literal["resend"] = "resend"
    provider_event_id: str = Field(min_length=1, max_length=500)
    correlation_id: UUID


class DeliveryWorkerResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    processed: int = 0
    submitted: int = 0
    delivered: int = 0
    retried: int = 0
    dead_lettered: int = 0
    suppressed: int = 0
    paused: int = 0


class NotificationDeliveryRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def relay_outbox(self, *, limit: int, email_enabled: bool) -> dict[str, int]:
        if not email_enabled:
            return {"queued": 0, "suppressed": 0, "ignored": 0}
        rows = (
            self.session.execute(
                text(
                    """
                select source.event_id, source.event_type, source.aggregate_id,
                       source.correlation_id, source.payload
                from integration.outbox_events source
                left join notification.transport_outbox_receipts receipt
                  on receipt.source_event_id = source.event_id
                where source.source_context = 'notification'
                  and source.event_type = any(:event_types)
                  and receipt.source_event_id is null
                  and source.available_at <= now()
                order by source.occurred_at, source.created_at, source.event_id
                limit :limit
                for update of source skip locked
                """
                ),
                {
                    "event_types": [
                        "notification.intent.created",
                        "notification.digest.queued",
                    ],
                    "limit": limit,
                },
            )
            .mappings()
            .all()
        )
        counts = {"queued": 0, "suppressed": 0, "ignored": 0}
        for row in rows:
            outcome = self._relay_event(row)
            counts[outcome] += 1
        self.session.commit()
        return counts

    def process_delivery_queue(
        self,
        *,
        transport: NotificationEmailTransport,
        renderer: NotificationTemplateRenderer,
        email_enabled: bool,
        visibility_timeout_seconds: int,
        max_attempts: int,
        base_backoff_seconds: int,
        limit: int,
    ) -> DeliveryWorkerResult:
        rows = self._read_queue(
            DELIVERY_QUEUE,
            visibility_timeout_seconds=visibility_timeout_seconds,
            quantity=limit,
        )
        counters = {
            "processed": 0,
            "submitted": 0,
            "delivered": 0,
            "retried": 0,
            "dead_lettered": 0,
            "suppressed": 0,
            "paused": 0,
        }
        for row in rows:
            outcome = self._process_delivery_message(
                row,
                transport=transport,
                renderer=renderer,
                email_enabled=email_enabled,
                max_attempts=max_attempts,
                base_backoff_seconds=base_backoff_seconds,
            )
            counters["processed"] += 1
            counters[outcome] += 1
        return DeliveryWorkerResult.model_validate(counters)

    def receive_resend_webhook(
        self,
        *,
        body: bytes,
        provider_event_id: str,
        correlation_id: UUID,
    ) -> str:
        minimal = minimal_resend_webhook_payload(body, provider_event_id=provider_event_id)
        payload_hash = hashlib.sha256(body).hexdigest()
        row = self.session.execute(
            text(
                """
                insert into notification.provider_webhook_events (
                  provider_event_id, provider, event_type, provider_message_id,
                  payload_hash, minimal_payload, signature_verified, correlation_id
                ) values (
                  :provider_event_id, 'resend', :event_type, :provider_message_id,
                  :payload_hash, cast(:minimal_payload as jsonb), true, :correlation_id
                ) on conflict (provider_event_id) do nothing
                returning provider_event_id
                """
            ),
            {
                "provider_event_id": provider_event_id,
                "event_type": minimal["event_type"],
                "provider_message_id": minimal["provider_message_id"],
                "payload_hash": payload_hash,
                "minimal_payload": json.dumps(minimal),
                "correlation_id": correlation_id,
            },
        ).scalar_one_or_none()
        if row is None:
            existing_hash = self.session.execute(
                text(
                    """
                    select payload_hash
                    from notification.provider_webhook_events
                    where provider_event_id = :provider_event_id
                    """
                ),
                {"provider_event_id": provider_event_id},
            ).scalar_one()
            if existing_hash != payload_hash:
                raise NotificationWebhookConflictError(
                    "Resend provider event ID was reused with a different payload"
                )
            self.session.commit()
            return "duplicate"
        job = NotificationWebhookJob(
            provider_event_id=provider_event_id,
            correlation_id=correlation_id,
        )
        self._send_queue(WEBHOOK_QUEUE, job.model_dump(mode="json"))
        self.session.commit()
        return "queued"

    def record_webhook_verification_failure(
        self,
        *,
        provider_event_id: str | None,
        reason: str,
        correlation_id: UUID,
    ) -> None:
        self._worker_event(
            event_type="webhook_verification_failed",
            delivery_id=None,
            queue_name=WEBHOOK_QUEUE,
            queue_message_id=None,
            attempt_number=None,
            reason=reason,
            details={"provider_event_id": provider_event_id},
            correlation_id=correlation_id,
        )
        self.session.commit()

    def process_webhook_queue(
        self,
        *,
        visibility_timeout_seconds: int,
        max_attempts: int,
        base_backoff_seconds: int,
        limit: int,
    ) -> dict[str, int]:
        rows = self._read_queue(
            WEBHOOK_QUEUE,
            visibility_timeout_seconds=visibility_timeout_seconds,
            quantity=limit,
        )
        counts = {"processed": 0, "ignored": 0, "retried": 0, "dead_lettered": 0}
        for row in rows:
            outcome = self._process_webhook_message(
                row,
                max_attempts=max_attempts,
                base_backoff_seconds=base_backoff_seconds,
            )
            counts[outcome] += 1
        return counts

    def requeue_delivery(self, delivery_id: UUID, *, correlation_id: UUID) -> int:
        row = (
            self.session.execute(
                text(
                    """
                select source_event_id, intent_id, digest_batch_id, state::text,
                       attempt_count
                from notification.delivery_jobs
                where delivery_id = :delivery_id
                for update
                """
                ),
                {"delivery_id": delivery_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise ValueError("Notification delivery job was not found")
        if row["state"] not in {"failed", "dead_lettered"}:
            raise ValueError("only failed or dead-lettered delivery jobs can be requeued")
        target_type = "intent" if row["intent_id"] is not None else "digest"
        target_id = row["intent_id"] or row["digest_batch_id"]
        job = NotificationDeliveryJob(
            delivery_id=delivery_id,
            source_event_id=row["source_event_id"],
            target_type=target_type,
            target_id=target_id,
            correlation_id=correlation_id,
        )
        message_id = self._send_queue(DELIVERY_QUEUE, job.model_dump(mode="json"))
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'queued', queue_message_id = :message_id,
                    attempt_cycle_start = attempt_count,
                    next_attempt_at = null, last_error_code = null,
                    queued_at = now(), updated_at = now(), correlation_id = :correlation_id
                where delivery_id = :delivery_id
                """
            ),
            {
                "delivery_id": delivery_id,
                "message_id": message_id,
                "correlation_id": correlation_id,
            },
        )
        self._worker_event(
            event_type="operator_requeued",
            delivery_id=delivery_id,
            queue_name=DELIVERY_QUEUE,
            queue_message_id=message_id,
            attempt_number=None,
            reason="operator_requeue",
            details={},
            correlation_id=correlation_id,
        )
        self.session.commit()
        return message_id

    def transport_metrics(
        self,
        *,
        queue_alert_depth: int,
        queue_alert_age_seconds: int,
    ) -> dict[str, object]:
        queue_depths: dict[str, int] = {}
        queue_ages: dict[str, float] = {}
        alerts: list[str] = []
        for queue_name in (DELIVERY_QUEUE, DELIVERY_DLQ, WEBHOOK_QUEUE, WEBHOOK_DLQ):
            metrics = self.session.execute(
                text("select to_jsonb(metrics) from pgmq.metrics(:queue_name) metrics"),
                {"queue_name": queue_name},
            ).scalar_one()
            values = _json_value(metrics)
            depth = int(values.get("queue_length", 0))
            age = float(values.get("oldest_msg_age_sec") or 0)
            queue_depths[queue_name] = depth
            queue_ages[queue_name] = age
            if depth >= queue_alert_depth:
                alerts.append(f"queue_depth:{queue_name}:{depth}")
            if age >= queue_alert_age_seconds:
                alerts.append(f"queue_age:{queue_name}:{int(age)}")
        row = (
            self.session.execute(
                text(
                    """
                select
                  count(*) filter (where outcome = 'retry') as retry_count,
                  count(*) filter (where outcome = 'dead_lettered') as dead_letter_count,
                  coalesce(max(provider_latency_ms), 0) as maximum_provider_latency_ms,
                  count(*) filter (where failure_code is not null) as provider_error_count,
                  (select count(*) from notification.provider_webhook_events
                    where event_type = 'email.bounced') as bounce_count,
                  (select count(*) from notification.provider_webhook_events
                    where event_type = 'email.complained') as complaint_count,
                  (select count(*) from notification.worker_events
                    where event_type = 'webhook_verification_failed')
                    as webhook_verification_failure_count
                from notification.transport_attempts
                """
                )
            )
            .mappings()
            .one()
        )
        if int(row["dead_letter_count"]) > 0:
            alerts.append(f"dead_lettered:{int(row['dead_letter_count'])}")
        return {
            "queue_depths": queue_depths,
            "oldest_queue_message_age_seconds": queue_ages,
            "retry_count": int(row["retry_count"]),
            "dead_letter_count": int(row["dead_letter_count"]),
            "maximum_provider_latency_seconds": int(row["maximum_provider_latency_ms"]) / 1000,
            "provider_error_count": int(row["provider_error_count"]),
            "bounce_count": int(row["bounce_count"]),
            "complaint_count": int(row["complaint_count"]),
            "webhook_verification_failure_count": int(row["webhook_verification_failure_count"]),
            "alerts": alerts,
        }

    def _relay_event(self, event: Any) -> Literal["queued", "suppressed", "ignored"]:
        event_type = str(event["event_type"])
        if event_type == "notification.intent.created":
            target = (
                self.session.execute(
                    text(
                        """
                    select i.intent_id, i.account_id, i.category::text, i.content_snapshot,
                           i.mandatory, c.enabled, c.delivery_state::text,
                           exists(
                             select 1 from notification.email_suppressions suppression
                             where suppression.account_id = i.account_id
                           ) as email_suppressed
                    from notification.intents i
                    join notification.intent_channels c on c.intent_id = i.intent_id
                    where i.intent_id = :intent_id and c.channel = 'email'
                    for update of i, c
                    """
                    ),
                    {"intent_id": UUID(str(event["aggregate_id"]))},
                )
                .mappings()
                .one_or_none()
            )
            if target is None:
                return self._receipt(event, outcome="ignored", reason="intent_not_found")
            if (
                not bool(target["enabled"])
                or target["delivery_state"] not in {"pending", "queued"}
                or bool(target["email_suppressed"])
            ):
                return self._receipt(event, outcome="suppressed", reason="email_channel_disabled")
            locale = _content_locale(_json_value(target["content_snapshot"]))
            return self._queue_delivery(
                event,
                account_id=target["account_id"],
                target_type="intent",
                target_id=target["intent_id"],
                locale=locale,
            )
        if event_type == "notification.digest.queued":
            target = (
                self.session.execute(
                    text(
                        """
                    select batch.batch_id, batch.account_id, batch.locale, batch.state::text,
                           jsonb_array_length(batch.content -> 'items') as item_count,
                           exists(
                             select 1 from notification.email_suppressions suppression
                             where suppression.account_id = batch.account_id
                           ) as email_suppressed
                    from notification.digest_batches batch
                    where batch.batch_id = :batch_id
                    for update
                    """
                    ),
                    {"batch_id": UUID(str(event["aggregate_id"]))},
                )
                .mappings()
                .one_or_none()
            )
            if target is None:
                return self._receipt(event, outcome="ignored", reason="digest_not_found")
            if (
                target["state"] != "queued"
                or int(target["item_count"]) == 0
                or bool(target["email_suppressed"])
            ):
                return self._receipt(event, outcome="suppressed", reason="digest_not_deliverable")
            return self._queue_delivery(
                event,
                account_id=target["account_id"],
                target_type="digest",
                target_id=target["batch_id"],
                locale=str(target["locale"]),
            )
        return self._receipt(event, outcome="ignored", reason="unsupported_event")

    def _queue_delivery(
        self,
        event: Any,
        *,
        account_id: UUID,
        target_type: Literal["intent", "digest"],
        target_id: UUID,
        locale: str,
    ) -> Literal["queued"]:
        delivery_id = uuid5(
            _DELIVERY_NAMESPACE,
            f"{event['event_id']}:{target_type}:{target_id}:email",
        )
        self.session.execute(
            text(
                """
                insert into notification.delivery_jobs (
                  delivery_id, source_event_id, account_id, intent_id, digest_batch_id,
                  locale, template_key, state, correlation_id
                ) values (
                  :delivery_id, :source_event_id, :account_id, :intent_id, :digest_batch_id,
                  :locale, :template_key, 'pending', :correlation_id
                ) on conflict (delivery_id) do nothing
                """
            ),
            {
                "delivery_id": delivery_id,
                "source_event_id": event["event_id"],
                "account_id": account_id,
                "intent_id": target_id if target_type == "intent" else None,
                "digest_batch_id": target_id if target_type == "digest" else None,
                "locale": "zh-CN" if locale == "zh-CN" else "en",
                "template_key": target_type,
                "correlation_id": event["correlation_id"],
            },
        )
        job = NotificationDeliveryJob(
            delivery_id=delivery_id,
            source_event_id=event["event_id"],
            target_type=target_type,
            target_id=target_id,
            correlation_id=event["correlation_id"],
        )
        message_id = self._send_queue(DELIVERY_QUEUE, job.model_dump(mode="json"))
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'queued', queue_message_id = :message_id,
                    queued_at = now(), updated_at = now()
                where delivery_id = :delivery_id
                """
            ),
            {"delivery_id": delivery_id, "message_id": message_id},
        )
        if target_type == "intent":
            self.session.execute(
                text(
                    """
                    update notification.intent_channels
                    set delivery_state = 'queued', queued_at = coalesce(queued_at, now())
                    where intent_id = :intent_id and channel = 'email'
                      and enabled = true and delivery_state = 'pending'
                    """
                ),
                {"intent_id": target_id},
            )
        self.session.execute(
            text(
                """
                insert into notification.transport_outbox_receipts (
                  source_event_id, event_type, outcome, delivery_id, queue_message_id,
                  correlation_id
                ) values (
                  :source_event_id, :event_type, 'queued', :delivery_id, :queue_message_id,
                  :correlation_id
                )
                """
            ),
            {
                "source_event_id": event["event_id"],
                "event_type": event["event_type"],
                "delivery_id": delivery_id,
                "queue_message_id": message_id,
                "correlation_id": event["correlation_id"],
            },
        )
        return "queued"

    def _receipt(
        self,
        event: Any,
        *,
        outcome: Literal["suppressed", "ignored"],
        reason: str,
    ) -> Literal["suppressed", "ignored"]:
        self.session.execute(
            text(
                """
                insert into notification.transport_outbox_receipts (
                  source_event_id, event_type, outcome, reason, correlation_id
                ) values (
                  :source_event_id, :event_type, :outcome, :reason, :correlation_id
                )
                """
            ),
            {
                "source_event_id": event["event_id"],
                "event_type": event["event_type"],
                "outcome": outcome,
                "reason": reason,
                "correlation_id": event["correlation_id"],
            },
        )
        return outcome

    def _process_delivery_message(
        self,
        message: Any,
        *,
        transport: NotificationEmailTransport,
        renderer: NotificationTemplateRenderer,
        email_enabled: bool,
        max_attempts: int,
        base_backoff_seconds: int,
    ) -> Literal["submitted", "delivered", "retried", "dead_lettered", "suppressed", "paused"]:
        msg_id = int(message["msg_id"])
        try:
            job = NotificationDeliveryJob.model_validate(_json_value(message["message"]))
        except ValidationError:
            correlation_id = uuid4()
            dlq_message_id = self._send_queue(
                DELIVERY_DLQ,
                {
                    "schema_version": 1,
                    "source_queue_message_id": msg_id,
                    "failure_code": "invalid_delivery_job",
                    "correlation_id": str(correlation_id),
                },
            )
            self._archive(DELIVERY_QUEUE, msg_id)
            self._worker_event(
                event_type="dead_lettered",
                delivery_id=None,
                queue_name=DELIVERY_DLQ,
                queue_message_id=dlq_message_id,
                attempt_number=None,
                reason="invalid_delivery_job",
                details={"source_queue_message_id": msg_id},
                correlation_id=correlation_id,
            )
            self.session.commit()
            return "dead_lettered"
        row = (
            self.session.execute(
                text(
                    """
                select job.*, account.email, account.state::text as account_state,
                       intent.category::text, intent.content_snapshot, intent.mandatory,
                       digest.frequency::text, digest.content as digest_content,
                       digest.state::text as digest_state,
                       exists(
                         select 1 from notification.email_suppressions suppression
                         where suppression.account_id = job.account_id
                       ) as email_suppressed,
                       exists(
                         select 1
                         from review_moderation.moderation_subject_status moderation
                         where moderation.account_id = job.account_id
                           and moderation.effective_notification_restricted
                       ) as notification_restricted
                from notification.delivery_jobs job
                join identity.accounts account on account.account_id = job.account_id
                left join notification.intents intent on intent.intent_id = job.intent_id
                left join notification.digest_batches digest
                  on digest.batch_id = job.digest_batch_id
                where job.delivery_id = :delivery_id
                for update of job
                """
                ),
                {"delivery_id": job.delivery_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return self._dead_letter_unknown(message, job, reason="delivery_job_not_found")
        if row["state"] in {"submitted", "delivered", "suppressed", "dead_lettered"}:
            self._archive(DELIVERY_QUEUE, msg_id)
            self.session.commit()
            if row["state"] == "submitted":
                return "submitted"
            if row["state"] == "delivered":
                return "delivered"
            if row["state"] == "dead_lettered":
                return "dead_lettered"
            return "suppressed"
        if not email_enabled:
            self._set_vt(DELIVERY_QUEUE, msg_id, 60)
            self.session.commit()
            return "paused"
        if row["account_state"] in {"deleting", "deleted"} or bool(row["email_suppressed"]):
            self._suppress_delivery(row, reason="email_channel_suppressed")
            self._archive(DELIVERY_QUEUE, msg_id)
            self.session.commit()
            return "suppressed"
        if bool(row["notification_restricted"]) and not bool(row["mandatory"]):
            self._suppress_delivery(row, reason="moderation_notification_restricted")
            self._archive(DELIVERY_QUEUE, msg_id)
            self.session.commit()
            return "suppressed"
        rendered = self._render_delivery(row, renderer)
        attempt_number = int(row["attempt_count"]) + 1
        cycle_attempt_number = attempt_number - int(row["attempt_cycle_start"])
        try:
            result = transport.send(
                delivery_id=job.delivery_id,
                to_email=str(row["email"]),
                rendered=rendered,
            )
        except NotificationTransportError as error:
            retry = error.retryable and cycle_attempt_number < max_attempts
            outcome = "retry" if retry else "dead_lettered"
            self._attempt(
                delivery_id=job.delivery_id,
                attempt_number=attempt_number,
                outcome=outcome,
                provider=transport.provider,
                provider_message_id=None,
                failure_code=error.code,
                retryable=error.retryable,
                latency_ms=error.latency_ms,
                correlation_id=job.correlation_id,
            )
            if retry:
                backoff = bounded_backoff_seconds(
                    cycle_attempt_number,
                    base_seconds=base_backoff_seconds,
                )
                self.session.execute(
                    text(
                        """
                        update notification.delivery_jobs
                        set state = 'retrying', attempt_count = :attempt_number,
                            next_attempt_at = now() + make_interval(secs => :backoff),
                            last_error_code = :failure_code, last_error_at = now(),
                            updated_at = now()
                        where delivery_id = :delivery_id
                        """
                    ),
                    {
                        "delivery_id": job.delivery_id,
                        "attempt_number": attempt_number,
                        "backoff": backoff,
                        "failure_code": error.code,
                    },
                )
                self._set_vt(DELIVERY_QUEUE, msg_id, backoff)
                self._worker_event(
                    event_type="retry_scheduled",
                    delivery_id=job.delivery_id,
                    queue_name=DELIVERY_QUEUE,
                    queue_message_id=msg_id,
                    attempt_number=attempt_number,
                    reason=error.code,
                    details={"backoff_seconds": backoff},
                    correlation_id=job.correlation_id,
                )
                self.session.commit()
                return "retried"
            self._dead_letter_delivery(
                message,
                job,
                row=row,
                failure_code=error.code,
                attempt_number=attempt_number,
            )
            self.session.commit()
            return "dead_lettered"
        self._attempt(
            delivery_id=job.delivery_id,
            attempt_number=attempt_number,
            outcome="submitted",
            provider=result.provider,
            provider_message_id=result.provider_message_id,
            failure_code=None,
            retryable=False,
            latency_ms=result.latency_ms,
            correlation_id=job.correlation_id,
        )
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'submitted', provider = :provider,
                    provider_message_id = :provider_message_id,
                    attempt_count = :attempt_number,
                    next_attempt_at = null, last_error_code = null,
                    updated_at = now()
                where delivery_id = :delivery_id
                """
            ),
            {
                "delivery_id": job.delivery_id,
                "provider": result.provider,
                "provider_message_id": result.provider_message_id,
                "attempt_number": attempt_number,
            },
        )
        self._archive(DELIVERY_QUEUE, msg_id)
        self.session.commit()
        return "submitted"

    def _render_delivery(
        self,
        row: Any,
        renderer: NotificationTemplateRenderer,
    ):
        if row["intent_id"] is not None:
            return renderer.render_intent(
                locale=str(row["locale"]),
                category=str(row["category"]),
                content=_json_value(row["content_snapshot"]),
            )
        return renderer.render_digest(
            locale=str(row["locale"]),
            frequency=str(row["frequency"]),
            content=_json_value(row["digest_content"]),
        )

    def _mark_domain_delivery(
        self,
        row: Any,
        *,
        state: Literal["delivered", "failed"],
        provider: str,
        provider_message_id: str | None,
        attempt_number: int,
        failure_code: str | None = None,
    ) -> None:
        if row["intent_id"] is not None:
            self.session.execute(
                text(
                    """
                    insert into notification.delivery_attempts (
                      intent_id, channel, attempt_number, idempotency_key, state,
                      provider, provider_message_id, failure_code, correlation_id
                    ) values (
                      :intent_id, 'email', :attempt_number, :idempotency_key, :state,
                      :provider, :provider_message_id, :failure_code, :correlation_id
                    ) on conflict (intent_id, channel, idempotency_key) do nothing
                    """
                ),
                {
                    "intent_id": row["intent_id"],
                    "attempt_number": attempt_number,
                    "idempotency_key": f"transport:{row['delivery_id']}:{attempt_number}",
                    "state": state,
                    "provider": provider,
                    "provider_message_id": provider_message_id,
                    "failure_code": (
                        None if state == "delivered" else failure_code or "delivery_exhausted"
                    ),
                    "correlation_id": row["correlation_id"],
                },
            )
            if state == "delivered":
                self.session.execute(
                    text(
                        """
                        update notification.intent_channels
                        set delivery_state = 'delivered', delivered_at = now()
                        where intent_id = :intent_id and channel = 'email'
                        """
                    ),
                    {"intent_id": row["intent_id"]},
                )
            else:
                self.session.execute(
                    text(
                        """
                        update notification.intent_channels
                        set delivery_state = 'failed', failed_at = now()
                        where intent_id = :intent_id and channel = 'email'
                        """
                    ),
                    {"intent_id": row["intent_id"]},
                )
        elif row["digest_batch_id"] is not None:
            if state == "delivered":
                self.session.execute(
                    text(
                        """
                        update notification.digest_batches
                        set state = 'delivered', delivered_at = now()
                        where batch_id = :batch_id and state <> 'retracted'
                        """
                    ),
                    {"batch_id": row["digest_batch_id"]},
                )
                self.session.execute(
                    text(
                        """
                        update notification.intent_channels channel
                        set delivery_state = 'delivered', delivered_at = now()
                        where channel.channel = 'email'
                          and channel.intent_id in (
                            select intent_id from notification.digest_items
                            where batch_id = :batch_id
                          )
                          and channel.delivery_state <> 'retracted'
                        """
                    ),
                    {"batch_id": row["digest_batch_id"]},
                )
            else:
                self.session.execute(
                    text(
                        """
                        update notification.digest_batches
                        set state = 'failed', failed_at = now()
                        where batch_id = :batch_id and state <> 'retracted'
                        """
                    ),
                    {"batch_id": row["digest_batch_id"]},
                )
                self.session.execute(
                    text(
                        """
                        update notification.intent_channels channel
                        set delivery_state = 'failed', failed_at = now()
                        where channel.channel = 'email'
                          and channel.intent_id in (
                            select intent_id from notification.digest_items
                            where batch_id = :batch_id
                          )
                          and channel.delivery_state <> 'retracted'
                        """
                    ),
                    {"batch_id": row["digest_batch_id"]},
                )

    def _suppress_delivery(self, row: Any, *, reason: str) -> None:
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'suppressed', suppressed_at = now(),
                    last_error_code = :reason, updated_at = now()
                where delivery_id = :delivery_id
                """
            ),
            {"delivery_id": row["delivery_id"], "reason": reason},
        )
        if row["intent_id"] is not None:
            self.session.execute(
                text(
                    """
                    update notification.intent_channels
                    set enabled = false, decision = 'suppressed',
                        suppression_reason = :reason, delivery_state = 'suppressed'
                    where intent_id = :intent_id and channel = 'email'
                      and delivery_state not in ('delivered', 'retracted')
                    """
                ),
                {"intent_id": row["intent_id"], "reason": reason},
            )
        elif row["digest_batch_id"] is not None:
            self.session.execute(
                text(
                    """
                    update notification.digest_batches
                    set state = 'failed', failed_at = coalesce(failed_at, now())
                    where batch_id = :batch_id and state = 'queued'
                    """
                ),
                {"batch_id": row["digest_batch_id"]},
            )

    def _dead_letter_delivery(
        self,
        message: Any,
        job: NotificationDeliveryJob,
        *,
        row: Any,
        failure_code: str,
        attempt_number: int,
    ) -> None:
        msg_id = int(message["msg_id"])
        dlq_message_id = self._send_queue(
            DELIVERY_DLQ,
            {
                **job.model_dump(mode="json"),
                "failure_code": failure_code,
                "attempt_number": attempt_number,
            },
        )
        self._archive(DELIVERY_QUEUE, msg_id)
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'dead_lettered', attempt_count = :attempt_number,
                    last_error_code = :failure_code, last_error_at = now(),
                    failed_at = now(), dead_lettered_at = now(), updated_at = now()
                where delivery_id = :delivery_id
                """
            ),
            {
                "delivery_id": job.delivery_id,
                "attempt_number": attempt_number,
                "failure_code": failure_code,
            },
        )
        self._mark_domain_delivery(
            row,
            state="failed",
            provider="worker",
            provider_message_id=None,
            attempt_number=attempt_number,
        )
        self._worker_event(
            event_type="dead_lettered",
            delivery_id=job.delivery_id,
            queue_name=DELIVERY_DLQ,
            queue_message_id=dlq_message_id,
            attempt_number=attempt_number,
            reason=failure_code,
            details={"source_queue_message_id": msg_id},
            correlation_id=job.correlation_id,
        )

    def _dead_letter_unknown(
        self,
        message: Any,
        job: NotificationDeliveryJob,
        *,
        reason: str,
    ) -> Literal["dead_lettered"]:
        msg_id = int(message["msg_id"])
        self._send_queue(
            DELIVERY_DLQ,
            {**job.model_dump(mode="json"), "failure_code": reason},
        )
        self._archive(DELIVERY_QUEUE, msg_id)
        self.session.commit()
        return "dead_lettered"

    def _process_webhook_message(
        self,
        message: Any,
        *,
        max_attempts: int,
        base_backoff_seconds: int,
    ) -> Literal["processed", "ignored", "retried", "dead_lettered"]:
        msg_id = int(message["msg_id"])
        read_count = int(message["read_ct"])
        try:
            job = NotificationWebhookJob.model_validate(_json_value(message["message"]))
        except ValidationError:
            correlation_id = uuid4()
            dlq_message_id = self._send_queue(
                WEBHOOK_DLQ,
                {
                    "schema_version": 1,
                    "source_queue_message_id": msg_id,
                    "failure_code": "invalid_webhook_job",
                    "correlation_id": str(correlation_id),
                },
            )
            self._archive(WEBHOOK_QUEUE, msg_id)
            self._worker_event(
                event_type="dead_lettered",
                delivery_id=None,
                queue_name=WEBHOOK_DLQ,
                queue_message_id=dlq_message_id,
                attempt_number=None,
                reason="invalid_webhook_job",
                details={"source_queue_message_id": msg_id},
                correlation_id=correlation_id,
            )
            self.session.commit()
            return "dead_lettered"
        try:
            event = (
                self.session.execute(
                    text(
                        """
                    select provider_event_id, event_type, provider_message_id,
                           minimal_payload, outcome, correlation_id
                    from notification.provider_webhook_events
                    where provider_event_id = :provider_event_id
                    for update
                    """
                    ),
                    {"provider_event_id": job.provider_event_id},
                )
                .mappings()
                .one_or_none()
            )
            if event is None:
                raise ValueError("webhook_event_not_found")
            if event["outcome"] in {"processed", "ignored"}:
                self._archive(WEBHOOK_QUEUE, msg_id)
                self.session.commit()
                return "ignored"
            delivery = None
            if event["provider_message_id"]:
                delivery = (
                    self.session.execute(
                        text(
                            """
                        select * from notification.delivery_jobs
                        where provider = 'resend'
                          and provider_message_id = :provider_message_id
                        for update
                        """
                        ),
                        {"provider_message_id": event["provider_message_id"]},
                    )
                    .mappings()
                    .one_or_none()
                )
            event_type = str(event["event_type"])
            outcome = "ignored"
            terminal_states = {"delivered", "failed", "suppressed", "dead_lettered"}
            if delivery is not None and event_type == "email.delivered":
                if delivery["state"] not in terminal_states:
                    self._finalize_provider_delivery(
                        delivery,
                        state="delivered",
                        failure_code=None,
                    )
                outcome = "processed"
            elif delivery is not None and event_type == "email.bounced":
                if delivery["state"] not in terminal_states:
                    self._finalize_provider_delivery(
                        delivery,
                        state="failed",
                        failure_code="hard_bounce",
                    )
                self._apply_email_suppression(
                    account_id=delivery["account_id"],
                    provider_event_id=event["provider_event_id"],
                    reason="hard_bounce",
                    correlation_id=event["correlation_id"],
                )
                outcome = "processed"
            elif delivery is not None and event_type == "email.complained":
                if delivery["state"] not in terminal_states:
                    self._finalize_provider_delivery(
                        delivery,
                        state="delivered",
                        failure_code=None,
                    )
                self._apply_email_suppression(
                    account_id=delivery["account_id"],
                    provider_event_id=event["provider_event_id"],
                    reason="complaint",
                    correlation_id=event["correlation_id"],
                )
                outcome = "processed"
            elif delivery is not None and event_type == "email.failed":
                if delivery["state"] not in terminal_states:
                    self._finalize_provider_delivery(
                        delivery,
                        state="failed",
                        failure_code="provider_failed_webhook",
                    )
                outcome = "processed"
            self.session.execute(
                text(
                    """
                    update notification.provider_webhook_events
                    set processed_at = now(), outcome = :outcome
                    where provider_event_id = :provider_event_id
                    """
                ),
                {"provider_event_id": event["provider_event_id"], "outcome": outcome},
            )
            self._archive(WEBHOOK_QUEUE, msg_id)
            self.session.commit()
            return "processed" if outcome == "processed" else "ignored"
        except Exception as error:
            self.session.rollback()
            if read_count < max_attempts:
                backoff = bounded_backoff_seconds(read_count, base_seconds=base_backoff_seconds)
                self._set_vt(WEBHOOK_QUEUE, msg_id, backoff)
                self.session.commit()
                return "retried"
            self._send_queue(
                WEBHOOK_DLQ,
                {
                    **job.model_dump(mode="json"),
                    "failure_code": type(error).__name__,
                },
            )
            self._archive(WEBHOOK_QUEUE, msg_id)
            self.session.commit()
            return "dead_lettered"

    def _finalize_provider_delivery(
        self,
        delivery: Any,
        *,
        state: Literal["delivered", "failed"],
        failure_code: str | None,
    ) -> None:
        if state == "delivered":
            self.session.execute(
                text(
                    """
                    update notification.delivery_jobs
                    set state = 'delivered', delivered_at = coalesce(delivered_at, now()),
                        updated_at = now()
                    where delivery_id = :delivery_id
                    """
                ),
                {"delivery_id": delivery["delivery_id"]},
            )
        else:
            self.session.execute(
                text(
                    """
                    update notification.delivery_jobs
                    set state = 'failed', failed_at = coalesce(failed_at, now()),
                        last_error_code = :failure_code, updated_at = now()
                    where delivery_id = :delivery_id
                    """
                ),
                {
                    "delivery_id": delivery["delivery_id"],
                    "failure_code": failure_code,
                },
            )
        self._mark_domain_delivery(
            delivery,
            state=state,
            provider=str(delivery["provider"] or "resend"),
            provider_message_id=delivery["provider_message_id"],
            attempt_number=max(1, int(delivery["attempt_count"])),
            failure_code=failure_code,
        )

    def _apply_email_suppression(
        self,
        *,
        account_id: UUID,
        provider_event_id: str,
        reason: Literal["hard_bounce", "complaint"],
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into notification.email_suppressions (
                  account_id, reason, provider_event_id, correlation_id
                ) values (
                  :account_id, :reason, :provider_event_id, :correlation_id
                ) on conflict (account_id) do update
                set reason = excluded.reason,
                    provider_event_id = excluded.provider_event_id,
                    created_at = now(),
                    correlation_id = excluded.correlation_id
                """
            ),
            {
                "account_id": account_id,
                "reason": reason,
                "provider_event_id": provider_event_id,
                "correlation_id": correlation_id,
            },
        )
        self.session.execute(
            text(
                """
                update notification.intent_channels channel
                set enabled = false, decision = 'suppressed',
                    suppression_reason = :reason, delivery_state = 'suppressed'
                from notification.intents intent
                where intent.intent_id = channel.intent_id
                  and intent.account_id = :account_id
                  and channel.channel = 'email'
                  and channel.delivery_state in ('pending', 'queued')
                """
            ),
            {"account_id": account_id, "reason": reason},
        )
        self.session.execute(
            text(
                """
                update notification.delivery_jobs
                set state = 'suppressed', suppressed_at = now(),
                    last_error_code = :reason, updated_at = now()
                where account_id = :account_id
                  and state in ('pending', 'queued', 'retrying')
                """
            ),
            {"account_id": account_id, "reason": reason},
        )

    def _attempt(
        self,
        *,
        delivery_id: UUID,
        attempt_number: int,
        outcome: str,
        provider: str,
        provider_message_id: str | None,
        failure_code: str | None,
        retryable: bool,
        latency_ms: int,
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into notification.transport_attempts (
                  delivery_id, attempt_number, outcome, provider, provider_message_id,
                  failure_code, retryable, provider_latency_ms, correlation_id
                ) values (
                  :delivery_id, :attempt_number, :outcome, :provider, :provider_message_id,
                  :failure_code, :retryable, :provider_latency_ms, :correlation_id
                ) on conflict (delivery_id, attempt_number) do nothing
                """
            ),
            {
                "delivery_id": delivery_id,
                "attempt_number": attempt_number,
                "outcome": outcome,
                "provider": provider,
                "provider_message_id": provider_message_id,
                "failure_code": failure_code,
                "retryable": retryable,
                "provider_latency_ms": latency_ms,
                "correlation_id": correlation_id,
            },
        )

    def _worker_event(
        self,
        *,
        event_type: str,
        delivery_id: UUID | None,
        queue_name: str,
        queue_message_id: int | None,
        attempt_number: int | None,
        reason: str,
        details: dict[str, object],
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into notification.worker_events (
                  event_type, delivery_id, queue_name, queue_message_id,
                  attempt_number, reason, details, correlation_id
                ) values (
                  :event_type, :delivery_id, :queue_name, :queue_message_id,
                  :attempt_number, :reason, cast(:details as jsonb), :correlation_id
                )
                """
            ),
            {
                "event_type": event_type,
                "delivery_id": delivery_id,
                "queue_name": queue_name,
                "queue_message_id": queue_message_id,
                "attempt_number": attempt_number,
                "reason": reason,
                "details": json.dumps(details),
                "correlation_id": correlation_id,
            },
        )

    def _read_queue(
        self,
        queue_name: str,
        *,
        visibility_timeout_seconds: int,
        quantity: int,
    ) -> list[Any]:
        return list(
            self.session.execute(
                text(
                    """
                    select msg_id, read_ct, enqueued_at, vt, message
                    from pgmq.read(:queue_name, :visibility_timeout, :quantity)
                    """
                ),
                {
                    "queue_name": queue_name,
                    "visibility_timeout": visibility_timeout_seconds,
                    "quantity": quantity,
                },
            ).mappings()
        )

    def _send_queue(self, queue_name: str, message: dict[str, object]) -> int:
        return int(
            self.session.execute(
                text("select pgmq.send(:queue_name, cast(:message as jsonb))"),
                {"queue_name": queue_name, "message": json.dumps(message)},
            ).scalar_one()
        )

    def _set_vt(self, queue_name: str, message_id: int, seconds: int) -> None:
        self.session.execute(
            text("select pgmq.set_vt(:queue_name, :message_id, :seconds)"),
            {"queue_name": queue_name, "message_id": message_id, "seconds": seconds},
        )

    def _archive(self, queue_name: str, message_id: int) -> None:
        self.session.execute(
            text("select pgmq.archive(:queue_name, :message_id)"),
            {"queue_name": queue_name, "message_id": message_id},
        )


def bounded_backoff_seconds(
    attempt_number: int,
    *,
    base_seconds: int,
    maximum_seconds: int = 3600,
) -> int:
    exponent = max(0, min(attempt_number - 1, 10))
    return min(maximum_seconds, base_seconds * (2**exponent))


def _content_locale(content: dict[str, object]) -> str:
    snapshots = content.get("localized_snapshots")
    if isinstance(snapshots, list):
        locales = {
            str(snapshot.get("locale")) for snapshot in snapshots if isinstance(snapshot, dict)
        }
        if locales & {"zh", "zh-CN"}:
            return "zh-CN"
    return "en"


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value
