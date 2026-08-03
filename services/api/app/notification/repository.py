from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope
from app.notification.metrics import notification_metrics
from app.notification.models import (
    DeliveryAttempt,
    DeliveryAttemptCommand,
    DigestBatch,
    DigestQueueCommand,
    InboxItem,
    InboxMarkCommand,
    InboxPage,
    InboxUnreadCount,
    NotificationCategory,
    NotificationChannel,
    NotificationMetricsSnapshot,
    NotificationPolicy,
    NotificationPreferenceCommand,
    NotificationPreferenceState,
    decode_inbox_cursor,
    encode_inbox_cursor,
)


class NotificationAccountUnavailableError(PermissionError):
    """Raised when account state blocks Notification reads or commands."""


class NotificationConflictError(RuntimeError):
    """Raised when a command or source event conflicts with durable state."""


class NotificationNotFoundError(LookupError):
    """Raised when an Inbox item does not resolve for the account."""


class NotificationRepository:
    def __init__(self, session: Session, *, cursor_signing_key: str) -> None:
        self.session = session
        self.cursor_signing_key = cursor_signing_key

    def project_outbox_event(self, event_id: UUID) -> dict[str, object]:
        row = (
            self.session.execute(
                text(
                    """
                select event_id, schema_version, event_type, event_version, source_context,
                       aggregate_type, aggregate_id, aggregate_version, idempotency_key,
                       correlation_id, causation_id, occurred_at, payload
                from integration.outbox_events
                where event_id = :event_id
                """
                ),
                {"event_id": event_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotificationNotFoundError("source event was not found")
        event = IntegrationEventEnvelope.model_validate(
            {
                "event_id": row["event_id"],
                "schema_version": row["schema_version"],
                "event_type": row["event_type"],
                "event_version": row["event_version"],
                "source_context": row["source_context"],
                "aggregate": {
                    "type": row["aggregate_type"],
                    "id": row["aggregate_id"],
                    "version": row["aggregate_version"],
                },
                "idempotency_key": row["idempotency_key"],
                "correlation_id": row["correlation_id"],
                "causation_id": row["causation_id"],
                "occurred_at": row["occurred_at"],
                "payload": _json_value(row["payload"]),
            }
        )
        return self.project(event)

    def project(self, event: IntegrationEventEnvelope) -> dict[str, object]:
        payload_hash = _payload_hash(event)
        self.session.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"notification-source-event:{event.event_id}"},
        )
        receipt = (
            self.session.execute(
                text(
                    """
                select event_type, payload_hash, outcome, intent_count, suppression_reason
                from notification.source_receipts
                where source_event_id = :event_id
                """
                ),
                {"event_id": event.event_id},
            )
            .mappings()
            .one_or_none()
        )
        if receipt is not None:
            if receipt["payload_hash"] != payload_hash or receipt["event_type"] != event.event_type:
                raise NotificationConflictError("source event id was reused with different content")
            return {**dict(receipt), "outcome": "duplicate"}

        source_id = self._source_id(event)
        if event.event_type == "activity.item.retracted":
            count = self._retract_source(
                source_context="activity",
                source_id=source_id,
                reason=str(event.payload.get("retraction_reason") or "public_activity_retracted"),
                correlation_id=event.correlation_id,
            )
            notification_metrics.record_retraction(count)
            result = self._record_receipt(event, payload_hash, "retracted", count, None)
            self.session.commit()
            return result

        corrected_retractions = 0
        if event.event_type == "activity.item.corrected":
            corrected_retractions = self._retract_corrected_original(
                source_id,
                event.correlation_id,
            )

        classification = NotificationPolicy.classify(event)
        if classification is None:
            outcome = "retracted" if corrected_retractions else "ignored"
            result = self._record_receipt(
                event,
                payload_hash,
                outcome,
                corrected_retractions,
                "notification_ineligible" if corrected_retractions else "unsupported_event",
            )
            self.session.commit()
            return result

        accounts = self._audience(event, mandatory=classification.mandatory)
        if not accounts:
            notification_metrics.record_suppression("no_eligible_audience")
            result = self._record_receipt(
                event,
                payload_hash,
                "suppressed",
                0,
                "no_eligible_audience",
            )
            self.session.commit()
            return result

        content = self._content_snapshot(event)
        created = 0
        for account in accounts:
            if self._create_intent(
                event=event,
                account=account,
                source_id=source_id,
                category=classification.category,
                mandatory=classification.mandatory,
                default_channels=classification.default_channels,
                content=content,
            ):
                created += 1

        outcome = "created" if created else "duplicate"
        result = self._record_receipt(event, payload_hash, outcome, created, None)
        notification_metrics.record_intents(
            created,
            latency_seconds=max(0.0, (datetime.now(UTC) - event.occurred_at).total_seconds()),
        )
        self.session.commit()
        return result

    def list_preferences(
        self,
        identity: RequestIdentity,
    ) -> list[NotificationPreferenceState]:
        self._require_active(identity)
        rows = (
            self.session.execute(
                text(
                    """
                    select account_id, category::text, channel::text, enabled, version, updated_at
                    from notification.preferences
                    where account_id = :account_id
                    order by category, channel
                    """
                ),
                {"account_id": identity.account_id},
            )
            .mappings()
            .all()
        )
        return [NotificationPreferenceState.model_validate(dict(row)) for row in rows]

    def set_preference(
        self,
        identity: RequestIdentity,
        *,
        category: NotificationCategory,
        channel: NotificationChannel,
        command: NotificationPreferenceCommand,
        correlation_id: UUID,
    ) -> NotificationPreferenceState:
        self._require_active(identity)
        if category is NotificationCategory.SECURITY_ROLE and not command.enabled:
            raise NotificationConflictError("mandatory security notifications cannot be disabled")
        subject_hash = _subject_hash(identity.account_id)
        replay = (
            self.session.execute(
                text(
                    """
                select category::text, channel::text, enabled
                from notification.preference_events
                where account_subject_hash = :subject_hash
                  and idempotency_key = :idempotency_key
                """
                ),
                {"subject_hash": subject_hash, "idempotency_key": command.idempotency_key},
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            if (
                replay["category"] != category.value
                or replay["channel"] != channel.value
                or bool(replay["enabled"]) != command.enabled
            ):
                raise NotificationConflictError("idempotency key was reused for another preference")
            return self._get_preference(identity.account_id, category, channel)

        current = self.session.execute(
            text(
                """
                select version from notification.preferences
                where account_id = :account_id and category = :category and channel = :channel
                for update
                """
            ),
            {
                "account_id": identity.account_id,
                "category": category.value,
                "channel": channel.value,
            },
        ).scalar_one_or_none()
        version = 1 if current is None else int(current) + 1
        self.session.execute(
            text(
                """
                insert into notification.preferences (
                  account_id, category, channel, enabled, version, updated_at
                ) values (:account_id, :category, :channel, :enabled, :version, now())
                on conflict (account_id, category, channel) do update
                set enabled = excluded.enabled, version = excluded.version, updated_at = now()
                """
            ),
            {
                "account_id": identity.account_id,
                "category": category.value,
                "channel": channel.value,
                "enabled": command.enabled,
                "version": version,
            },
        )
        self.session.execute(
            text(
                """
                insert into notification.preference_events (
                  account_subject_hash, category, channel, enabled, preference_version,
                  idempotency_key, correlation_id
                ) values (
                  :subject_hash, :category, :channel, :enabled, :version,
                  :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "subject_hash": subject_hash,
                "category": category.value,
                "channel": channel.value,
                "enabled": command.enabled,
                "version": version,
                "idempotency_key": command.idempotency_key,
                "correlation_id": correlation_id,
            },
        )
        self._audit(
            event_type="notification.preference.changed",
            actor_account_id=identity.account_id,
            subject_account_id=identity.account_id,
            target_type="notification_preference",
            target_id=f"{category.value}:{channel.value}",
            outcome="enabled" if command.enabled else "disabled",
            reason=None,
            details={"version": version},
            correlation_id=correlation_id,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
        )
        self._outbox(
            event_type="notification.preference.changed",
            aggregate_type="notification_preference",
            aggregate_id=f"{identity.account_id}:{category.value}:{channel.value}",
            aggregate_version=version,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "account_id": str(identity.account_id),
                "category": category.value,
                "channel": channel.value,
                "enabled": command.enabled,
                "version": version,
            },
        )
        self.session.commit()
        return self._get_preference(identity.account_id, category, channel)

    def list_inbox(
        self,
        identity: RequestIdentity,
        *,
        page_size: int,
        cursor: str | None,
    ) -> InboxPage:
        self._require_active(identity)
        created_at = None
        inbox_item_id = None
        if cursor:
            created_at, inbox_item_id = decode_inbox_cursor(
                cursor,
                account_id=identity.account_id,
                signing_key=self.cursor_signing_key,
            )
        rows = (
            self.session.execute(
                text(
                    """
                select inbox_item_id, intent_id, category::text,
                       case
                         when body_expires_at <= now() then jsonb_build_object(
                           'state', 'expired', 'body_version', body_version
                         )
                         else body
                       end as body,
                       body_version, created_at, body_expires_at, seen_at, read_at,
                       retracted_at, retraction_reason
                from notification.inbox_items
                where account_id = :account_id
                  and (
                    cast(:cursor_created_at as timestamptz) is null
                    or (created_at, inbox_item_id) < (
                      cast(:cursor_created_at as timestamptz),
                      cast(:cursor_item_id as uuid)
                    )
                  )
                order by created_at desc, inbox_item_id desc
                limit :limit
                """
                ),
                {
                    "account_id": identity.account_id,
                    "cursor_created_at": created_at,
                    "cursor_item_id": inbox_item_id,
                    "limit": max(1, min(page_size, 100)) + 1,
                },
            )
            .mappings()
            .all()
        )
        visible = rows[: max(1, min(page_size, 100))]
        items = [self._inbox_item(row) for row in visible]
        next_cursor = None
        if len(rows) > len(visible) and items:
            last = items[-1]
            next_cursor = encode_inbox_cursor(
                created_at=last.created_at,
                inbox_item_id=last.inbox_item_id,
                account_id=identity.account_id,
                signing_key=self.cursor_signing_key,
            )
        return InboxPage(
            items=items,
            next_cursor=next_cursor,
            unread_count=self._unread_count(identity.account_id),
        )

    def unread_count(self, identity: RequestIdentity) -> InboxUnreadCount:
        self._require_active(identity)
        return InboxUnreadCount(unread_count=self._unread_count(identity.account_id))

    def mark_read(
        self,
        identity: RequestIdentity,
        inbox_item_id: UUID,
        command: InboxMarkCommand,
        *,
        correlation_id: UUID,
    ) -> InboxItem:
        self._require_active(identity)
        replay = self._state_replay(identity.account_id, command.idempotency_key)
        if replay is not None:
            if replay["action"] != "read" or replay["inbox_item_id"] != inbox_item_id:
                raise NotificationConflictError(
                    "idempotency key was reused for another Inbox command"
                )
            return self._get_inbox_item(identity.account_id, inbox_item_id)
        row = self.session.execute(
            text(
                """
                update notification.inbox_items
                set seen_at = coalesce(seen_at, now()),
                    read_at = coalesce(read_at, now()),
                    updated_at = now()
                where inbox_item_id = :inbox_item_id and account_id = :account_id
                returning inbox_item_id
                """
            ),
            {"inbox_item_id": inbox_item_id, "account_id": identity.account_id},
        ).scalar_one_or_none()
        if row is None:
            raise NotificationNotFoundError("Inbox item was not found")
        self._record_state_event(
            identity.account_id,
            inbox_item_id=inbox_item_id,
            action="read",
            affected_count=1,
            idempotency_key=command.idempotency_key,
            correlation_id=correlation_id,
        )
        self.session.commit()
        return self._get_inbox_item(identity.account_id, inbox_item_id)

    def mark_all_read(
        self,
        identity: RequestIdentity,
        command: InboxMarkCommand,
        *,
        correlation_id: UUID,
    ) -> InboxUnreadCount:
        self._require_active(identity)
        replay = self._state_replay(identity.account_id, command.idempotency_key)
        if replay is not None:
            if replay["action"] != "read_all" or replay["inbox_item_id"] is not None:
                raise NotificationConflictError(
                    "idempotency key was reused for another Inbox command"
                )
            return InboxUnreadCount(unread_count=self._unread_count(identity.account_id))
        count = int(
            self.session.execute(
                text(
                    """
                    update notification.inbox_items
                    set seen_at = coalesce(seen_at, now()),
                        read_at = coalesce(read_at, now()),
                        updated_at = now()
                    where account_id = :account_id and read_at is null
                    """
                ),
                {"account_id": identity.account_id},
            ).rowcount
            or 0
        )
        self._record_state_event(
            identity.account_id,
            inbox_item_id=None,
            action="read_all",
            affected_count=count,
            idempotency_key=command.idempotency_key,
            correlation_id=correlation_id,
        )
        self.session.commit()
        return InboxUnreadCount(unread_count=0)

    def queue_digest(
        self,
        identity: RequestIdentity,
        command: DigestQueueCommand,
        *,
        correlation_id: UUID,
    ) -> DigestBatch:
        self._require_active(identity)
        if command.period_end <= command.period_start:
            raise NotificationConflictError("digest period_end must be after period_start")
        replay = (
            self.session.execute(
                text(
                    """
                select * from notification.digest_batches
                where account_id = :account_id and idempotency_key = :idempotency_key
                """
                ),
                {
                    "account_id": identity.account_id,
                    "idempotency_key": command.idempotency_key,
                },
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            expected = (
                replay["frequency"],
                replay["period_start"],
                replay["period_end"],
                replay["locale"],
            )
            supplied = (
                command.frequency.value,
                command.period_start,
                command.period_end,
                command.locale,
            )
            if expected != supplied:
                raise NotificationConflictError("idempotency key was reused for another Digest")
            return self._digest(replay)

        intents = (
            self.session.execute(
                text(
                    """
                select i.intent_id, i.category::text, i.content_snapshot, i.created_at
                from notification.intents i
                join notification.intent_channels c on c.intent_id = i.intent_id
                where i.account_id = :account_id
                  and i.state = 'active'
                  and i.mandatory = false
                  and c.channel = 'email'
                  and c.enabled = true
                  and c.delivery_state = 'pending'
                  and i.created_at >= :period_start
                  and i.created_at < :period_end
                order by i.created_at, i.intent_id
                """
                ),
                {
                    "account_id": identity.account_id,
                    "period_start": command.period_start,
                    "period_end": command.period_end,
                },
            )
            .mappings()
            .all()
        )
        batch_id = uuid4()
        content = {
            "locale": command.locale,
            "frequency": command.frequency.value,
            "items": [
                {
                    "intent_id": str(row["intent_id"]),
                    "category": row["category"],
                    "content": _json_value(row["content_snapshot"]),
                }
                for row in intents
            ],
        }
        row = (
            self.session.execute(
                text(
                    """
                insert into notification.digest_batches (
                  batch_id, account_id, frequency, state, locale, period_start, period_end,
                  content, content_version, idempotency_key, correlation_id, queued_at
                ) values (
                  :batch_id, :account_id, :frequency, 'queued', :locale,
                  :period_start, :period_end, cast(:content as jsonb), 1,
                  :idempotency_key, :correlation_id, now()
                ) returning *
                """
                ),
                {
                    "batch_id": batch_id,
                    "account_id": identity.account_id,
                    "frequency": command.frequency.value,
                    "locale": command.locale,
                    "period_start": command.period_start,
                    "period_end": command.period_end,
                    "content": json.dumps(content),
                    "idempotency_key": command.idempotency_key,
                    "correlation_id": correlation_id,
                },
            )
            .mappings()
            .one()
        )
        for ordinal, intent in enumerate(intents, start=1):
            self.session.execute(
                text(
                    """
                    insert into notification.digest_items (
                      batch_id, intent_id, ordinal, content_snapshot
                    ) values (:batch_id, :intent_id, :ordinal, cast(:content as jsonb))
                    """
                ),
                {
                    "batch_id": batch_id,
                    "intent_id": intent["intent_id"],
                    "ordinal": ordinal,
                    "content": json.dumps(_json_value(intent["content_snapshot"])),
                },
            )
            self.session.execute(
                text(
                    """
                    update notification.intent_channels
                    set delivery_state = 'queued', queued_at = now()
                    where intent_id = :intent_id
                      and channel = 'email'
                      and enabled = true
                      and delivery_state = 'pending'
                    """
                ),
                {"intent_id": intent["intent_id"]},
            )
        self._outbox(
            event_type="notification.digest.queued",
            aggregate_type="digest_batch",
            aggregate_id=str(batch_id),
            aggregate_version=1,
            idempotency_key=_scoped_key(identity.account_id, command.idempotency_key),
            correlation_id=correlation_id,
            payload={
                "batch_id": str(batch_id),
                "account_id": str(identity.account_id),
                "frequency": command.frequency.value,
                "item_count": len(intents),
                "content_version": 1,
            },
        )
        self.session.commit()
        return self._digest(row)

    def record_delivery_attempt(
        self,
        *,
        intent_id: UUID,
        channel: NotificationChannel,
        command: DeliveryAttemptCommand,
        correlation_id: UUID,
    ) -> DeliveryAttempt:
        if channel is NotificationChannel.STATION:
            raise NotificationConflictError(
                "station delivery is represented by the native Inbox item"
            )
        self.session.execute(
            text("select pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"notification-delivery:{intent_id}:{channel.value}"},
        )
        replay = (
            self.session.execute(
                text(
                    """
                select attempt_id, intent_id, channel::text, attempt_number, state::text,
                       provider, provider_message_id, failure_code, failure_detail,
                       attempted_at, correlation_id
                from notification.delivery_attempts
                where intent_id = :intent_id
                  and channel = :channel
                  and idempotency_key = :idempotency_key
                """
                ),
                {
                    "intent_id": intent_id,
                    "channel": channel.value,
                    "idempotency_key": command.idempotency_key,
                },
            )
            .mappings()
            .one_or_none()
        )
        if replay is not None:
            expected = (
                replay["state"],
                replay["provider"],
                replay["provider_message_id"],
                replay["failure_code"],
                replay["failure_detail"],
            )
            supplied = (
                command.state.value,
                command.provider,
                command.provider_message_id,
                command.failure_code,
                command.failure_detail,
            )
            if expected != supplied:
                self.session.rollback()
                raise NotificationConflictError(
                    "idempotency key was reused for another delivery result"
                )
            result = self._delivery_attempt(replay)
            self.session.commit()
            return result

        channel_state = (
            self.session.execute(
                text(
                    """
                select i.state::text as intent_state, c.enabled,
                       c.delivery_state::text as delivery_state
                from notification.intents i
                join notification.intent_channels c on c.intent_id = i.intent_id
                where i.intent_id = :intent_id and c.channel = :channel
                for update of i, c
                """
                ),
                {"intent_id": intent_id, "channel": channel.value},
            )
            .mappings()
            .one_or_none()
        )
        if channel_state is None:
            self.session.rollback()
            raise NotificationNotFoundError("Notification Intent channel was not found")
        if (
            channel_state["intent_state"] == "retracted"
            or channel_state["delivery_state"] == "retracted"
        ):
            self.session.rollback()
            raise NotificationConflictError("retracted Notification cannot be delivered")
        if not bool(channel_state["enabled"]) or channel_state["delivery_state"] == "suppressed":
            self.session.rollback()
            raise NotificationConflictError("suppressed Notification channel cannot be delivered")
        if channel_state["delivery_state"] == "delivered":
            self.session.rollback()
            raise NotificationConflictError("Notification channel was already delivered")

        attempt_number = int(
            self.session.execute(
                text(
                    """
                    select coalesce(max(attempt_number), 0) + 1
                    from notification.delivery_attempts
                    where intent_id = :intent_id and channel = :channel
                    """
                ),
                {"intent_id": intent_id, "channel": channel.value},
            ).scalar_one()
        )
        row = (
            self.session.execute(
                text(
                    """
                insert into notification.delivery_attempts (
                  intent_id, channel, attempt_number, idempotency_key, state,
                  provider, provider_message_id, failure_code, failure_detail,
                  correlation_id
                ) values (
                  :intent_id, :channel, :attempt_number, :idempotency_key, :state,
                  :provider, :provider_message_id, :failure_code, :failure_detail,
                  :correlation_id
                )
                returning attempt_id, intent_id, channel::text, attempt_number, state::text,
                          provider, provider_message_id, failure_code, failure_detail,
                          attempted_at, correlation_id
                """
                ),
                {
                    "intent_id": intent_id,
                    "channel": channel.value,
                    "attempt_number": attempt_number,
                    "idempotency_key": command.idempotency_key,
                    "state": command.state.value,
                    "provider": command.provider,
                    "provider_message_id": command.provider_message_id,
                    "failure_code": command.failure_code,
                    "failure_detail": command.failure_detail,
                    "correlation_id": correlation_id,
                },
            )
            .mappings()
            .one()
        )
        delivered = command.state.value == "delivered"
        self.session.execute(
            text(
                """
                update notification.intent_channels
                set delivery_state = :state,
                    delivered_at = case when :delivered then now() else delivered_at end,
                    failed_at = case when :delivered then failed_at else now() end
                where intent_id = :intent_id and channel = :channel
                """
            ),
            {
                "state": command.state.value,
                "delivered": delivered,
                "intent_id": intent_id,
                "channel": channel.value,
            },
        )
        self._outbox(
            event_type="notification.delivery.recorded",
            aggregate_type="notification_intent",
            aggregate_id=str(intent_id),
            aggregate_version=attempt_number,
            idempotency_key=_delivery_key(
                intent_id,
                channel,
                command.idempotency_key,
            ),
            correlation_id=correlation_id,
            payload={
                "intent_id": str(intent_id),
                "channel": channel.value,
                "attempt_number": attempt_number,
                "state": command.state.value,
                "provider": command.provider,
                "provider_message_id": command.provider_message_id,
                "failure_code": command.failure_code,
            },
        )
        self.session.commit()
        return self._delivery_attempt(row)

    def purge_expired_bodies(
        self,
        *,
        account_id: UUID | None = None,
        commit: bool = True,
    ) -> int:
        result = self.session.execute(
            text(
                """
                update notification.inbox_items
                set body = jsonb_build_object('state', 'expired', 'body_version', body_version),
                    body_purged_at = now(),
                    updated_at = now()
                where body_purged_at is null
                  and body_expires_at <= now()
                  and (
                    cast(:account_id as uuid) is null
                    or account_id = cast(:account_id as uuid)
                  )
                """
            ),
            {"account_id": account_id},
        )
        count = int(result.rowcount or 0)
        if commit:
            self.session.commit()
        return count

    def metrics(
        self,
        *,
        queue_alert_depth: int = 100,
        queue_alert_age_seconds: int = 300,
    ) -> NotificationMetricsSnapshot:
        counts = (
            self.session.execute(
                text(
                    """
                select
                  (select count(*) from notification.intents) as intent_created_count,
                  (
                    select count(*) from notification.inbox_items
                    where read_at is null
                  ) as unread_count,
                  coalesce(
                    (
                      select max(
                        greatest(
                          0,
                          extract(epoch from (receipt.processed_at - source.occurred_at))
                        )
                      )
                      from notification.source_receipts receipt
                      join integration.outbox_events source
                        on source.event_id = receipt.source_event_id
                    ),
                    0
                  )::double precision as maximum_intent_latency_seconds,
                  (
                    select count(*) from notification.intents
                    where state = 'retracted'
                  ) as retraction_count,
                  (
                    select count(*) from notification.intents
                    where
                      (state = 'active' and (
                        retracted_at is not null or retraction_reason is not null
                      ))
                      or (state = 'retracted' and (
                        retracted_at is null or retraction_reason is null
                      ))
                  ) + (
                    select count(*) from notification.intent_channels
                    where delivery_state <> 'retracted'
                      and (
                        (enabled and (
                          suppression_reason is not null or delivery_state = 'suppressed'
                        ))
                        or (not enabled and (
                          suppression_reason is null or delivery_state <> 'suppressed'
                        ))
                      )
                  ) + (
                    select count(*) from notification.inbox_items
                    where
                      (read_at is not null and (seen_at is null or read_at < seen_at))
                      or (retracted_at is null and retraction_reason is not null)
                      or (retracted_at is not null and retraction_reason is null)
                  ) + (
                    select count(*) from notification.digest_batches
                    where
                      (state = 'building' and queued_at is not null)
                      or (state = 'queued' and queued_at is null)
                      or (state = 'delivered' and (
                        queued_at is null or delivered_at is null
                      ))
                      or (state = 'failed' and (
                        queued_at is null or failed_at is null
                      ))
                      or (state = 'retracted' and (
                        queued_at is null or retracted_at is null
                      ))
                  ) as state_inconsistency_count
                """
                )
            )
            .mappings()
            .one()
        )
        suppression_rows = (
            self.session.execute(
                text(
                    """
                select reason, sum(reason_count)::bigint as reason_count
                from (
                  select suppression_reason as reason, count(*)::bigint as reason_count
                  from notification.intent_channels
                  where suppression_reason is not null
                  group by suppression_reason
                  union all
                  select suppression_reason as reason, count(*)::bigint as reason_count
                  from notification.source_receipts
                  where suppression_reason is not null
                  group by suppression_reason
                ) grouped
                group by reason
                order by reason
                """
                )
            )
            .mappings()
            .all()
        )
        from app.notification.delivery import NotificationDeliveryRepository

        transport = NotificationDeliveryRepository(self.session).transport_metrics(
            queue_alert_depth=queue_alert_depth,
            queue_alert_age_seconds=queue_alert_age_seconds,
        )
        return NotificationMetricsSnapshot(
            intent_created_count=int(counts["intent_created_count"]),
            suppression_counts={
                str(row["reason"]): int(row["reason_count"]) for row in suppression_rows
            },
            unread_count=int(counts["unread_count"]),
            maximum_intent_latency_seconds=float(counts["maximum_intent_latency_seconds"]),
            retraction_count=int(counts["retraction_count"]),
            state_inconsistency_count=int(counts["state_inconsistency_count"]),
            **transport,
        )

    def _audience(
        self,
        event: IntegrationEventEnvelope,
        *,
        mandatory: bool,
    ) -> list[dict[str, object]]:
        if event.event_type.startswith("activity.item."):
            panda_ids = [str(value) for value in event.payload.get("target_panda_ids", [])]
            if bool(event.payload.get("sitewide", False)):
                rows = (
                    self.session.execute(
                        text(
                            """
                        select account_id, state::text from identity.accounts
                        where state = 'active'
                        order by account_id
                        """
                        )
                    )
                    .mappings()
                    .all()
                )
            elif panda_ids:
                rows = (
                    self.session.execute(
                        text(
                            """
                        select distinct a.account_id, a.state::text
                        from engagement.follows f
                        join identity.accounts a on a.account_id = f.account_id
                        where f.state = 'active'
                          and a.state = 'active'
                          and f.panda_id = any(:panda_ids)
                        order by a.account_id
                        """
                        ),
                        {"panda_ids": panda_ids},
                    )
                    .mappings()
                    .all()
                )
            else:
                return []
            return [dict(row) for row in rows]

        account_id = event.payload.get("account_id")
        if account_id is None:
            return []
        allowed_states = ["active", "suspended"] if mandatory else ["active"]
        row = (
            self.session.execute(
                text(
                    """
                select account_id, state::text from identity.accounts
                where account_id = :account_id and state::text = any(:states)
                """
                ),
                {"account_id": UUID(str(account_id)), "states": allowed_states},
            )
            .mappings()
            .one_or_none()
        )
        return [] if row is None else [dict(row)]

    def _create_intent(
        self,
        *,
        event: IntegrationEventEnvelope,
        account: dict[str, object],
        source_id: str,
        category: NotificationCategory,
        mandatory: bool,
        default_channels: tuple[NotificationChannel, ...],
        content: dict[str, object],
    ) -> bool:
        account_id = UUID(str(account["account_id"]))
        logical_key = _logical_notification_key(
            event=event,
            source_id=source_id,
            category=category,
            account_id=account_id,
        )
        preferences = self._preference_snapshot(account_id)
        row = (
            self.session.execute(
                text(
                    """
                insert into notification.intents (
                  logical_key, source_event_id, source_event_type, source_context,
                  source_id, source_version, account_id, category, mandatory,
                  audience_snapshot, preference_snapshot, content_snapshot, correlation_id
                ) values (
                  :logical_key, :source_event_id, :source_event_type, :source_context,
                  :source_id, :source_version, :account_id, :category, :mandatory,
                  cast(:audience_snapshot as jsonb), cast(:preference_snapshot as jsonb),
                  cast(:content_snapshot as jsonb), :correlation_id
                ) on conflict (logical_key) do nothing
                returning intent_id, created_at
                """
                ),
                {
                    "logical_key": logical_key,
                    "source_event_id": event.event_id,
                    "source_event_type": event.event_type,
                    "source_context": event.source_context,
                    "source_id": source_id,
                    "source_version": event.aggregate.version,
                    "account_id": account_id,
                    "category": category.value,
                    "mandatory": mandatory,
                    "audience_snapshot": json.dumps(
                        {"account_state": account["state"], "account_id": str(account_id)}
                    ),
                    "preference_snapshot": json.dumps(preferences),
                    "content_snapshot": json.dumps(content),
                    "correlation_id": event.correlation_id,
                },
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            return False
        intent_id = UUID(str(row["intent_id"]))
        station_enabled = False
        for channel in NotificationChannel:
            explicit = preferences.get(channel.value)
            if mandatory and channel in default_channels:
                enabled = True
                decision = "mandatory"
                suppression_reason = None
            elif mandatory:
                enabled = False
                decision = "suppressed"
                suppression_reason = "not_mandatory_channel"
            elif explicit is not None:
                enabled = bool(explicit["enabled"])
                decision = "preference" if enabled else "suppressed"
                suppression_reason = None if enabled else "preference_disabled"
            else:
                enabled = channel in default_channels
                decision = "default" if enabled else "suppressed"
                suppression_reason = None if enabled else "consent_absent"
            delivery_state = "pending" if enabled else "suppressed"
            self.session.execute(
                text(
                    """
                    insert into notification.intent_channels (
                      intent_id, channel, enabled, decision, suppression_reason,
                      preference_version, delivery_state
                    ) values (
                      :intent_id, :channel, :enabled, :decision, :suppression_reason,
                      :preference_version, :delivery_state
                    )
                    """
                ),
                {
                    "intent_id": intent_id,
                    "channel": channel.value,
                    "enabled": enabled,
                    "decision": decision,
                    "suppression_reason": suppression_reason,
                    "preference_version": None if explicit is None else explicit["version"],
                    "delivery_state": delivery_state,
                },
            )
            if suppression_reason:
                notification_metrics.record_suppression(suppression_reason)
            if channel is NotificationChannel.STATION:
                station_enabled = enabled
        if station_enabled:
            self.session.execute(
                text(
                    """
                    insert into notification.inbox_items (
                      intent_id, account_id, category, body, created_at, body_expires_at
                    ) values (
                      :intent_id, :account_id, :category, cast(:body as jsonb),
                      :created_at, :created_at + interval '90 days'
                    )
                    """
                ),
                {
                    "intent_id": intent_id,
                    "account_id": account_id,
                    "category": category.value,
                    "body": json.dumps(content),
                    "created_at": row["created_at"],
                },
            )
        self._audit(
            event_type="notification.intent.created",
            actor_account_id=None,
            subject_account_id=account_id,
            target_type="notification_intent",
            target_id=str(intent_id),
            outcome="created",
            reason=None,
            details={"category": category.value, "mandatory": mandatory},
            correlation_id=event.correlation_id,
            idempotency_key=f"intent:{intent_id}",
        )
        self._outbox(
            event_type="notification.intent.created",
            aggregate_type="notification_intent",
            aggregate_id=str(intent_id),
            aggregate_version=1,
            idempotency_key=f"intent:{intent_id}",
            correlation_id=event.correlation_id,
            payload={
                "intent_id": str(intent_id),
                "account_id": str(account_id),
                "category": category.value,
                "mandatory": mandatory,
                "station_enabled": station_enabled,
            },
            causation_id=event.event_id,
        )
        return True

    def _retract_source(
        self,
        *,
        source_context: str,
        source_id: str,
        reason: str,
        correlation_id: UUID,
    ) -> int:
        rows = (
            self.session.execute(
                text(
                    """
                update notification.intents
                set state = 'retracted', retracted_at = now(), retraction_reason = :reason
                where source_context = :source_context and source_id = :source_id
                  and state = 'active'
                returning intent_id, account_id
                """
                ),
                {"source_context": source_context, "source_id": source_id, "reason": reason},
            )
            .mappings()
            .all()
        )
        for row in rows:
            intent_id = row["intent_id"]
            self.session.execute(
                text(
                    """
                    update notification.intent_channels
                    set delivery_state = 'retracted'
                    where intent_id = :intent_id and delivery_state <> 'delivered'
                    """
                ),
                {"intent_id": intent_id},
            )
            self.session.execute(
                text(
                    """
                    update notification.digest_batches
                    set state = 'retracted', retracted_at = coalesce(retracted_at, now())
                    where state in ('queued', 'failed')
                      and batch_id in (
                        select batch_id from notification.digest_items
                        where intent_id = :intent_id
                      )
                    """
                ),
                {"intent_id": intent_id},
            )
            self.session.execute(
                text(
                    """
                    update notification.inbox_items
                    set body = jsonb_build_object(
                          'state', 'retracted',
                          'reason', cast(:reason as text),
                          'title_zh', '通知已撤回',
                          'title_en', 'Notification retracted'
                        ),
                        body_version = body_version + 1,
                        retracted_at = now(),
                        retraction_reason = :reason,
                        updated_at = now()
                    where intent_id = :intent_id
                    """
                ),
                {"intent_id": intent_id, "reason": reason},
            )
            self._audit(
                event_type="notification.intent.retracted",
                actor_account_id=None,
                subject_account_id=UUID(str(row["account_id"])),
                target_type="notification_intent",
                target_id=str(intent_id),
                outcome="retracted",
                reason=reason,
                details={},
                correlation_id=correlation_id,
                idempotency_key=f"retract:{intent_id}",
            )
        return len(rows)

    def _retract_corrected_original(
        self,
        correction_activity_id: str,
        correlation_id: UUID,
    ) -> int:
        originals = (
            self.session.execute(
                text(
                    """
                select activity_id from activity.items
                where correction_activity_id = :correction_activity_id
                """
                ),
                {"correction_activity_id": UUID(correction_activity_id)},
            )
            .scalars()
            .all()
        )
        total = 0
        for original in originals:
            count = self._retract_source(
                source_context="activity",
                source_id=str(original),
                reason=f"superseded_by_correction:{correction_activity_id}",
                correlation_id=correlation_id,
            )
            notification_metrics.record_retraction(count)
            total += count
        return total

    def _content_snapshot(self, event: IntegrationEventEnvelope) -> dict[str, object]:
        if event.event_type.startswith("activity.item."):
            activity_id = UUID(str(event.payload["activity_id"]))
            row = (
                self.session.execute(
                    text(
                        """
                    select activity_id, activity_type, importance, occurred_at, published_at,
                           localized_snapshots, media, provenance, retraction_state,
                           retracted_at, retraction_reason
                    from activity.items where activity_id = :activity_id
                    """
                    ),
                    {"activity_id": activity_id},
                )
                .mappings()
                .one_or_none()
            )
            if row is not None:
                return {
                    "activity_id": str(row["activity_id"]),
                    "activity_type": row["activity_type"],
                    "importance": row["importance"],
                    "occurred_at": row["occurred_at"].isoformat(),
                    "published_at": row["published_at"].isoformat(),
                    "localized_snapshots": _json_value(row["localized_snapshots"]),
                    "media": _json_value(row["media"]),
                    "provenance": _json_value(row["provenance"]),
                    "retraction_state": row["retraction_state"],
                    "retracted_at": (
                        None if row["retracted_at"] is None else row["retracted_at"].isoformat()
                    ),
                    "retraction_reason": row["retraction_reason"],
                }
        allowed_keys = {
            "account_id",
            "submission_id",
            "panda_id",
            "status",
            "outcome",
            "public_reason_code",
            "public_message_key",
            "public_message_version",
            "notification_link",
            "active_revision_number",
        }
        if event.event_type == "community.submission.contributor_status_changed":
            allowed_keys.discard("account_id")
        return {
            "event_type": event.event_type,
            "occurred_at": event.occurred_at.isoformat(),
            "payload": {key: value for key, value in event.payload.items() if key in allowed_keys},
        }

    def _preference_snapshot(self, account_id: UUID) -> dict[str, dict[str, object]]:
        rows = (
            self.session.execute(
                text(
                    """
                select channel::text, enabled, version
                from notification.preferences
                where account_id = :account_id
                """
                ),
                {"account_id": account_id},
            )
            .mappings()
            .all()
        )
        return {
            str(row["channel"]): {"enabled": bool(row["enabled"]), "version": int(row["version"])}
            for row in rows
        }

    def _record_receipt(
        self,
        event: IntegrationEventEnvelope,
        payload_hash: str,
        outcome: str,
        intent_count: int,
        suppression_reason: str | None,
    ) -> dict[str, object]:
        self.session.execute(
            text(
                """
                insert into notification.source_receipts (
                  source_event_id, event_type, payload_hash, outcome, intent_count,
                  suppression_reason, correlation_id
                ) values (
                  :source_event_id, :event_type, :payload_hash, :outcome, :intent_count,
                  :suppression_reason, :correlation_id
                )
                """
            ),
            {
                "source_event_id": event.event_id,
                "event_type": event.event_type,
                "payload_hash": payload_hash,
                "outcome": outcome,
                "intent_count": intent_count,
                "suppression_reason": suppression_reason,
                "correlation_id": event.correlation_id,
            },
        )
        return {
            "event_type": event.event_type,
            "payload_hash": payload_hash,
            "outcome": outcome,
            "intent_count": intent_count,
            "suppression_reason": suppression_reason,
        }

    def _get_preference(
        self,
        account_id: UUID,
        category: NotificationCategory,
        channel: NotificationChannel,
    ) -> NotificationPreferenceState:
        row = (
            self.session.execute(
                text(
                    """
                select account_id, category::text, channel::text, enabled, version, updated_at
                from notification.preferences
                where account_id = :account_id and category = :category and channel = :channel
                """
                ),
                {"account_id": account_id, "category": category.value, "channel": channel.value},
            )
            .mappings()
            .one()
        )
        return NotificationPreferenceState.model_validate(dict(row))

    def _get_inbox_item(self, account_id: UUID, inbox_item_id: UUID) -> InboxItem:
        row = (
            self.session.execute(
                text(
                    """
                select inbox_item_id, intent_id, category::text,
                       case
                         when body_expires_at <= now() then jsonb_build_object(
                           'state', 'expired', 'body_version', body_version
                         )
                         else body
                       end as body,
                       body_version, created_at, body_expires_at, seen_at, read_at,
                       retracted_at, retraction_reason
                from notification.inbox_items
                where account_id = :account_id and inbox_item_id = :inbox_item_id
                """
                ),
                {"account_id": account_id, "inbox_item_id": inbox_item_id},
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotificationNotFoundError("Inbox item was not found")
        return self._inbox_item(row)

    def _inbox_item(self, row: Any) -> InboxItem:
        return InboxItem.model_validate(
            {
                "inbox_item_id": row["inbox_item_id"],
                "intent_id": row["intent_id"],
                "category": row["category"],
                "body": _json_value(row["body"]),
                "body_version": row["body_version"],
                "created_at": row["created_at"],
                "expires_at": row["body_expires_at"],
                "seen_at": row["seen_at"],
                "read_at": row["read_at"],
                "retracted_at": row["retracted_at"],
                "retraction_reason": row["retraction_reason"],
            }
        )

    def _unread_count(self, account_id: UUID) -> int:
        return int(
            self.session.execute(
                text(
                    """
                    select count(*) from notification.inbox_items
                    where account_id = :account_id and read_at is null
                    """
                ),
                {"account_id": account_id},
            ).scalar_one()
        )

    def _state_replay(self, account_id: UUID, idempotency_key: str) -> Any:
        return (
            self.session.execute(
                text(
                    """
                select action, inbox_item_id from notification.inbox_state_events
                where account_subject_hash = :subject_hash
                  and idempotency_key = :idempotency_key
                """
                ),
                {"subject_hash": _subject_hash(account_id), "idempotency_key": idempotency_key},
            )
            .mappings()
            .one_or_none()
        )

    def _record_state_event(
        self,
        account_id: UUID,
        *,
        inbox_item_id: UUID | None,
        action: str,
        affected_count: int,
        idempotency_key: str,
        correlation_id: UUID,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into notification.inbox_state_events (
                  inbox_item_id, account_subject_hash, action, affected_count,
                  idempotency_key, correlation_id
                ) values (
                  :inbox_item_id, :subject_hash, :action, :affected_count,
                  :idempotency_key, :correlation_id
                )
                """
            ),
            {
                "inbox_item_id": inbox_item_id,
                "subject_hash": _subject_hash(account_id),
                "action": action,
                "affected_count": affected_count,
                "idempotency_key": idempotency_key,
                "correlation_id": correlation_id,
            },
        )

    def _delivery_attempt(self, row: Any) -> DeliveryAttempt:
        return DeliveryAttempt.model_validate(
            {
                "attempt_id": row["attempt_id"],
                "intent_id": row["intent_id"],
                "channel": row["channel"],
                "attempt_number": row["attempt_number"],
                "state": row["state"],
                "provider": row["provider"],
                "provider_message_id": row["provider_message_id"],
                "failure_code": row["failure_code"],
                "failure_detail": row["failure_detail"],
                "attempted_at": row["attempted_at"],
                "correlation_id": row["correlation_id"],
            }
        )

    def _digest(self, row: Any) -> DigestBatch:
        return DigestBatch.model_validate(
            {
                "batch_id": row["batch_id"],
                "account_id": row["account_id"],
                "frequency": row["frequency"],
                "state": row["state"],
                "content": _json_value(row["content"]),
                "content_version": row["content_version"],
                "period_start": row["period_start"],
                "period_end": row["period_end"],
                "queued_at": row["queued_at"],
                "created_at": row["created_at"],
            }
        )

    def _source_id(self, event: IntegrationEventEnvelope) -> str:
        if event.event_type.startswith("activity.item."):
            return str(event.payload.get("activity_id") or event.aggregate.id)
        return str(event.payload.get("submission_id") or event.aggregate.id)

    def _require_active(self, identity: RequestIdentity) -> None:
        if identity.state is not AccountState.ACTIVE:
            raise NotificationAccountUnavailableError("account state blocks Notification access")

    def _audit(
        self,
        *,
        event_type: str,
        actor_account_id: UUID | None,
        subject_account_id: UUID | None,
        target_type: str,
        target_id: str,
        outcome: str,
        reason: str | None,
        details: dict[str, object],
        correlation_id: UUID,
        idempotency_key: str,
    ) -> None:
        self.session.execute(
            text(
                """
                insert into notification.audit_events (
                  event_type, actor_subject_hash, subject_account_hash, target_type, target_id,
                  outcome, reason, details, correlation_id, idempotency_key
                ) values (
                  :event_type, :actor_subject_hash, :subject_account_hash, :target_type, :target_id,
                  :outcome, :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
                )
                """
            ),
            {
                "event_type": event_type,
                "actor_subject_hash": (
                    None if actor_account_id is None else _subject_hash(actor_account_id)
                ),
                "subject_account_hash": (
                    None if subject_account_id is None else _subject_hash(subject_account_id)
                ),
                "target_type": target_type,
                "target_id": target_id,
                "outcome": outcome,
                "reason": reason,
                "details": json.dumps(details),
                "correlation_id": correlation_id,
                "idempotency_key": idempotency_key,
            },
        )

    def _outbox(
        self,
        *,
        event_type: str,
        aggregate_type: str,
        aggregate_id: str,
        aggregate_version: int | None,
        idempotency_key: str,
        correlation_id: UUID,
        payload: dict[str, object],
        causation_id: UUID | None = None,
    ) -> None:
        envelope = IntegrationEventEnvelope(
            event_type=event_type,
            source_context="notification",
            aggregate=AggregateReference(
                type=aggregate_type,
                id=aggregate_id,
                version=aggregate_version,
            ),
            idempotency_key=idempotency_key,
            correlation_id=correlation_id,
            causation_id=causation_id,
            payload=payload,
        )
        record = envelope.to_outbox_record()
        self.session.execute(
            text(
                """
                insert into integration.outbox_events (
                  event_id, schema_version, event_type, event_version, source_context,
                  aggregate_type, aggregate_id, aggregate_version, idempotency_key,
                  correlation_id, causation_id, occurred_at, payload
                ) values (
                  :event_id, :schema_version, :event_type, :event_version, :source_context,
                  :aggregate_type, :aggregate_id, :aggregate_version, :idempotency_key,
                  :correlation_id, :causation_id, :occurred_at, cast(:payload as jsonb)
                )
                """
            ),
            {**record, "payload": json.dumps(record["payload"])},
        )


def _payload_hash(event: IntegrationEventEnvelope) -> str:
    serialized = json.dumps(event.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()


def _subject_hash(account_id: UUID) -> str:
    return hashlib.sha256(f"notification-account:{account_id}".encode()).hexdigest()


def _logical_notification_key(
    *,
    event: IntegrationEventEnvelope,
    source_id: str,
    category: NotificationCategory,
    account_id: UUID,
) -> str:
    material = {
        "account_id": str(account_id),
        "category": category.value,
        "event_type": event.event_type,
        "source_context": event.source_context,
        "source_id": source_id,
        "source_version": event.aggregate.version,
    }
    serialized = json.dumps(material, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()


def _delivery_key(
    intent_id: UUID,
    channel: NotificationChannel,
    idempotency_key: str,
) -> str:
    digest = hashlib.sha256(f"{intent_id}:{channel.value}:{idempotency_key}".encode()).hexdigest()
    return f"notification-delivery:{digest}"


def _scoped_key(account_id: UUID, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"{account_id}:{idempotency_key}".encode()).hexdigest()
    return f"notification:{digest}"


def _json_value(value: Any) -> Any:
    if isinstance(value, str):
        return json.loads(value)
    return value
