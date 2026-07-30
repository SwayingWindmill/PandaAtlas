from __future__ import annotations

import json
import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.session import configure_database, session_scope
from app.engagement.repository import EngagementRepository
from app.identity.models import AccountState, RequestIdentity
from app.integration.events import AggregateReference, IntegrationEventEnvelope
from app.notification.delivery import (
    NotificationDeliveryRepository,
    NotificationWebhookConflictError,
)
from app.notification.models import (
    DeliveryAttemptCommand,
    DigestFrequency,
    DigestQueueCommand,
    InboxMarkCommand,
    NotificationCategory,
    NotificationChannel,
    NotificationDeliveryState,
    NotificationPreferenceCommand,
)
from app.notification.repository import NotificationConflictError, NotificationRepository
from app.notification.templates import NotificationTemplateRenderer
from app.notification.transport import (
    NotificationTransportError,
    ProviderDeliveryResult,
)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run Notification database tests")
    value = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not value:
        pytest.skip("Set REAL_DB_URL or DATABASE_URL")
    configure_database(value)
    try:
        yield value
    finally:
        configure_database(None)


@pytest.fixture(autouse=True)
def clean_notification_state(real_db_url: str) -> Iterator[None]:
    _ = real_db_url

    def clear() -> None:
        with session_scope() as session:
            assert session is not None
            session.execute(
                text(
                    """
                    truncate table
                      notification.worker_events,
                      notification.email_suppressions,
                      notification.provider_webhook_events,
                      notification.transport_attempts,
                      notification.delivery_jobs,
                      notification.transport_outbox_receipts,
                      notification.digest_items,
                      notification.digest_batches,
                      notification.delivery_attempts,
                      notification.inbox_state_events,
                      notification.inbox_items,
                      notification.intent_channels,
                      notification.intents,
                      notification.source_receipts,
                      notification.preference_events,
                      notification.preferences,
                      notification.audit_events
                    cascade
                    """
                )
            )
            for queue_name in (
                "notification_deliveries",
                "notification_deliveries_dlq",
                "notification_webhooks",
                "notification_webhooks_dlq",
            ):
                session.execute(text(f"delete from pgmq.q_{queue_name}"))
                session.execute(text(f"delete from pgmq.a_{queue_name}"))
            session.execute(text("delete from engagement.follows"))
            session.execute(
                text(
                    """
                    delete from integration.outbox_events
                    where event_type like 'notification.%'
                    """
                )
            )
            session.execute(
                text(
                    """
                    delete from activity.targets
                    where activity_id in (
                      select activity_id from activity.items
                      where source_id like 'notification-test:%'
                    )
                    """
                )
            )
            session.execute(
                text("delete from activity.items where source_id like 'notification-test:%'")
            )
            session.commit()

    clear()
    try:
        yield
    finally:
        clear()


def _identity(account_id: UUID, *, state: AccountState = AccountState.ACTIVE) -> RequestIdentity:
    now = datetime.now(UTC)
    return RequestIdentity(
        account_id=account_id,
        email=f"notification-test-{account_id}@example.invalid",
        session_id="notification-real-db-test",
        state=state,
        roles=frozenset(),
        capabilities=frozenset(),
        authenticated_at=now,
        authentication_method="otp",
        issued_at=now,
        expires_at=now + timedelta(hours=1),
        assurance_level="aal1",
        recent_auth=True,
    )


def _insert_account(session: object, account_id: UUID) -> None:
    email = f"notification-test-{account_id}@example.invalid"
    session.execute(
        text(
            """
            insert into auth.users (
              instance_id, id, aud, role, email, encrypted_password,
              email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
              created_at, updated_at
            ) values (
              '00000000-0000-0000-0000-000000000000', :account_id,
              'authenticated', 'authenticated', :email, '', now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              '{}'::jsonb, now(), now()
            )
            """
        ),
        {"account_id": account_id, "email": email},
    )
    session.execute(
        text("insert into identity.accounts (account_id, email) values (:account_id, :email)"),
        {"account_id": account_id, "email": email},
    )


def _insert_follow(session: object, account_id: UUID, panda_id: str) -> None:
    session.execute(
        text(
            """
            insert into engagement.follows (
              account_id, panda_id, state, first_followed_at, followed_at
            ) values (:account_id, :panda_id, 'active', now(), now())
            """
        ),
        {"account_id": account_id, "panda_id": panda_id},
    )


def _insert_activity(
    session: object,
    *,
    panda_id: str,
    activity_type: str,
    importance: str,
) -> UUID:
    activity_id = uuid4()
    source_event_id = uuid4()
    source_id = f"notification-test:{activity_id}"
    now = datetime.now(UTC)
    session.execute(
        text(
            """
            insert into activity.items (
              activity_id, source_type, source_id, source_version, source_event_id,
              activity_type, importance, visibility, sitewide, notification_eligible,
              occurred_at, occurred_precision, published_at, updated_at,
              localization_key, localization_version, localized_snapshots, provenance
            ) values (
              :activity_id, 'archive.release', :source_id, 1, :source_event_id,
              :activity_type, :importance, 'public', false, true,
              :occurred_at, 'exact', :published_at, :published_at,
              'notification.test', 1,
              '[{"locale":"zh-CN","title":"测试动态","summary":"公开安全摘要"},
                {"locale":"en","title":"Test Activity","summary":"Public-safe summary"}]'::jsonb,
              '{"public_reference_ids":[]}'::jsonb
            )
            """
        ),
        {
            "activity_id": activity_id,
            "source_id": source_id,
            "source_event_id": source_event_id,
            "activity_type": activity_type,
            "importance": importance,
            "occurred_at": now,
            "published_at": now,
        },
    )
    session.execute(
        text(
            """
            insert into activity.targets (activity_id, target_type, target_id)
            values (:activity_id, 'panda', :panda_id)
            """
        ),
        {"activity_id": activity_id, "panda_id": panda_id},
    )
    return activity_id


def _activity_event(
    activity_id: UUID,
    *,
    activity_type: str,
    importance: str,
    event_type: str = "activity.item.published",
    event_id: UUID | None = None,
) -> IntegrationEventEnvelope:
    return IntegrationEventEnvelope(
        event_id=event_id or uuid4(),
        event_type=event_type,
        source_context="activity",
        aggregate=AggregateReference(type="activity_item", id=str(activity_id), version=1),
        idempotency_key=f"activity-{activity_id}-{event_type}",
        correlation_id=uuid4(),
        payload={
            "activity_id": str(activity_id),
            "activity_type": activity_type,
            "target_panda_ids": ["panda-notification-test"],
            "target_institution_ids": [],
            "importance": importance,
            "visibility": "public",
            "sitewide": False,
            "notification_eligible": True,
            "published_at": datetime.now(UTC).isoformat(),
            "is_backfill": False,
            "outcome": "created",
        },
    )


def _insert_outbox_event(session: object, event: IntegrationEventEnvelope) -> None:
    record = event.to_outbox_record()
    session.execute(
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
    session.commit()


def test_notification_intent_inbox_digest_and_retraction_lifecycle(real_db_url: str) -> None:
    _ = real_db_url
    account_id = uuid4()
    identity = _identity(account_id)
    panda_id = "panda-notification-test"

    with session_scope() as session:
        assert session is not None
        _insert_account(session, account_id)
        _insert_follow(session, account_id, panda_id)
        first_activity = _insert_activity(
            session,
            panda_id=panda_id,
            activity_type="panda.birthday",
            importance="ordinary",
        )
        session.commit()

        repository = NotificationRepository(
            session,
            cursor_signing_key="notification-real-db-signing-key",
        )
        first_event = _activity_event(
            first_activity,
            activity_type="panda.birthday",
            importance="ordinary",
        )
        _insert_outbox_event(session, first_event)
        first_result = repository.project_outbox_event(first_event.event_id)
        replay = repository.project(first_event)
        assert first_result["outcome"] == "created"
        assert first_result["intent_count"] == 1
        assert replay["outcome"] == "duplicate"

        first_page = repository.list_inbox(identity, page_size=1, cursor=None)
        assert first_page.unread_count == 1
        assert len(first_page.items) == 1
        first_item = first_page.items[0]
        assert first_item.category is NotificationCategory.BIRTHDAY
        channel_rows = (
            session.execute(
                text(
                    """
                select channel::text, enabled, suppression_reason
                from notification.intent_channels
                where intent_id = :intent_id order by channel
                """
                ),
                {"intent_id": first_item.intent_id},
            )
            .mappings()
            .all()
        )
        decisions = {row["channel"]: row for row in channel_rows}
        assert decisions["station"]["enabled"] is True
        assert decisions["email"]["enabled"] is False
        assert decisions["email"]["suppression_reason"] == "consent_absent"

        email_preference = repository.set_preference(
            identity,
            category=NotificationCategory.MAJOR_ACTIVITY,
            channel=NotificationChannel.EMAIL,
            command=NotificationPreferenceCommand(
                enabled=True,
                idempotency_key="enable-major-email",
            ),
            correlation_id=uuid4(),
        )
        assert email_preference.enabled is True

        second_activity = _insert_activity(
            session,
            panda_id=panda_id,
            activity_type="panda.relocated",
            importance="important",
        )
        session.commit()
        second_event = _activity_event(
            second_activity,
            activity_type="panda.relocated",
            importance="important",
        )
        second_result = repository.project(second_event)
        assert second_result["intent_count"] == 1

        page = repository.list_inbox(identity, page_size=1, cursor=None)
        assert page.unread_count == 2
        assert page.next_cursor is not None
        older = repository.list_inbox(identity, page_size=10, cursor=page.next_cursor)
        assert len(older.items) == 1

        read_item = repository.mark_read(
            identity,
            page.items[0].inbox_item_id,
            InboxMarkCommand(idempotency_key="read-one-item"),
            correlation_id=uuid4(),
        )
        assert read_item.read_at is not None
        read_replay = repository.mark_read(
            identity,
            page.items[0].inbox_item_id,
            InboxMarkCommand(idempotency_key="read-one-item"),
            correlation_id=uuid4(),
        )
        assert read_replay.read_at == read_item.read_at
        with pytest.raises(NotificationConflictError):
            repository.mark_all_read(
                identity,
                InboxMarkCommand(idempotency_key="read-one-item"),
                correlation_id=uuid4(),
            )
        session.rollback()
        assert (
            repository.mark_all_read(
                identity,
                InboxMarkCommand(idempotency_key="read-all-items"),
                correlation_id=uuid4(),
            ).unread_count
            == 0
        )

        session.execute(
            text(
                """
                update notification.inbox_items
                set created_at = now() - interval '100 days',
                    body_expires_at = now() - interval '10 days'
                where inbox_item_id = :inbox_item_id
                """
            ),
            {"inbox_item_id": first_item.inbox_item_id},
        )
        session.commit()
        assert repository.purge_expired_bodies(account_id=account_id) == 1
        expired = repository.list_inbox(identity, page_size=10, cursor=None)
        expired_item = next(
            item for item in expired.items if item.inbox_item_id == first_item.inbox_item_id
        )
        assert expired_item.body["state"] == "expired"

        digest = repository.queue_digest(
            identity,
            DigestQueueCommand(
                frequency=DigestFrequency.DAILY,
                period_start=datetime.now(UTC) - timedelta(hours=1),
                period_end=datetime.now(UTC) + timedelta(hours=1),
                locale="zh-CN",
                idempotency_key="daily-digest-2026-07-30",
            ),
            correlation_id=uuid4(),
        )
        assert digest.state.value == "queued"
        assert len(digest.content["items"]) == 1
        with pytest.raises(DBAPIError):
            session.execute(
                text(
                    """
                    update notification.digest_batches
                    set content = cast(:content as jsonb)
                    where batch_id = :batch_id
                    """
                ),
                {"batch_id": digest.batch_id, "content": '{"tampered":true}'},
            )
            session.commit()
        session.rollback()
        with pytest.raises(DBAPIError):
            session.execute(
                text("delete from notification.digest_items where batch_id = :batch_id"),
                {"batch_id": digest.batch_id},
            )
            session.commit()
        session.rollback()

        session.execute(
            text(
                """
                update activity.items
                set retraction_state = 'retracted', retracted_at = now(),
                    retraction_reason = 'source corrected', updated_at = now()
                where activity_id = :activity_id
                """
            ),
            {"activity_id": second_activity},
        )
        session.commit()
        retraction = _activity_event(
            second_activity,
            activity_type="panda.relocated",
            importance="important",
            event_type="activity.item.retracted",
        ).model_copy(
            update={
                "payload": {
                    **_activity_event(
                        second_activity,
                        activity_type="panda.relocated",
                        importance="important",
                    ).payload,
                    "notification_eligible": False,
                    "retraction_reason": "source corrected",
                }
            }
        )
        result = repository.project(retraction)
        assert result["outcome"] == "retracted"
        retracted_body = (
            session.execute(
                text(
                    """
                select i.body, i.retracted_at from notification.inbox_items i
                join notification.intents n on n.intent_id = i.intent_id
                where n.source_id = :source_id
                """
                ),
                {"source_id": str(second_activity)},
            )
            .mappings()
            .one()
        )
        assert retracted_body["body"]["state"] == "retracted"
        assert retracted_body["retracted_at"] is not None
        assert (
            session.execute(
                text(
                    "select state::text from notification.digest_batches where batch_id = :batch_id"
                ),
                {"batch_id": digest.batch_id},
            ).scalar_one()
            == "retracted"
        )

        session.execute(
            text("update identity.accounts set state = 'suspended' where account_id = :account_id"),
            {"account_id": account_id},
        )
        suspended_activity = _insert_activity(
            session,
            panda_id=panda_id,
            activity_type="panda.health_major",
            importance="important",
        )
        session.commit()
        assert (
            repository.project(
                _activity_event(
                    suspended_activity,
                    activity_type="panda.health_major",
                    importance="important",
                )
            )["outcome"]
            == "suppressed"
        )

        security_event = IntegrationEventEnvelope(
            event_type="identity.security.changed",
            source_context="identity",
            aggregate=AggregateReference(type="account", id=str(account_id), version=2),
            idempotency_key="security-session-revoked",
            correlation_id=uuid4(),
            payload={"account_id": str(account_id), "reason": "session-revoked"},
        )
        security_result = repository.project(security_event)
        assert security_result["intent_count"] == 1
        mandatory_channels = (
            session.execute(
                text(
                    """
                select channel::text, enabled, decision
                from notification.intent_channels c
                join notification.intents i on i.intent_id = c.intent_id
                where i.source_event_id = :source_event_id
                order by channel
                """
                ),
                {"source_event_id": security_event.event_id},
            )
            .mappings()
            .all()
        )
        mandatory = {row["channel"]: row for row in mandatory_channels}
        assert mandatory["station"]["decision"] == "mandatory"
        assert mandatory["email"]["decision"] == "mandatory"
        assert mandatory["web_push"]["enabled"] is False
        security_intent_id = UUID(
            str(
                session.execute(
                    text(
                        "select intent_id from notification.intents "
                        "where source_event_id = :source_event_id"
                    ),
                    {"source_event_id": security_event.event_id},
                ).scalar_one()
            )
        )
        failed_attempt = repository.record_delivery_attempt(
            intent_id=security_intent_id,
            channel=NotificationChannel.EMAIL,
            command=DeliveryAttemptCommand(
                idempotency_key="security-email-attempt-1",
                state=NotificationDeliveryState.FAILED,
                provider="test-mailer",
                failure_code="temporary-provider-error",
                failure_detail="retryable",
            ),
            correlation_id=uuid4(),
        )
        assert failed_attempt.attempt_number == 1
        failed_replay = repository.record_delivery_attempt(
            intent_id=security_intent_id,
            channel=NotificationChannel.EMAIL,
            command=DeliveryAttemptCommand(
                idempotency_key="security-email-attempt-1",
                state=NotificationDeliveryState.FAILED,
                provider="test-mailer",
                failure_code="temporary-provider-error",
                failure_detail="retryable",
            ),
            correlation_id=uuid4(),
        )
        assert failed_replay.attempt_id == failed_attempt.attempt_id
        delivered_attempt = repository.record_delivery_attempt(
            intent_id=security_intent_id,
            channel=NotificationChannel.EMAIL,
            command=DeliveryAttemptCommand(
                idempotency_key="security-email-attempt-2",
                state=NotificationDeliveryState.DELIVERED,
                provider="test-mailer",
                provider_message_id="message-184",
            ),
            correlation_id=uuid4(),
        )
        assert delivered_attempt.attempt_number == 2
        assert (
            session.execute(
                text(
                    """
                select delivery_state::text from notification.intent_channels
                where intent_id = :intent_id and channel = 'email'
                """
                ),
                {"intent_id": security_intent_id},
            ).scalar_one()
            == "delivered"
        )
        with pytest.raises(DBAPIError):
            session.execute(
                text("delete from notification.delivery_attempts where attempt_id = :attempt_id"),
                {"attempt_id": delivered_attempt.attempt_id},
            )
            session.commit()
        session.rollback()

        later_security_event = IntegrationEventEnvelope(
            event_type="identity.security.changed",
            source_context="identity",
            aggregate=AggregateReference(type="account", id=str(account_id), version=3),
            idempotency_key="security-session-rotated",
            correlation_id=uuid4(),
            payload={
                "account_id": str(account_id),
                "public_reason_code": "session-rotated",
            },
        )
        assert repository.project(later_security_event)["intent_count"] == 1
        assert (
            session.execute(
                text(
                    """
                select count(*) from notification.intents
                where account_id = :account_id and category = 'security_role'
                """
                ),
                {"account_id": account_id},
            ).scalar_one()
            == 2
        )
        metrics = repository.metrics()
        assert metrics.intent_created_count >= 4
        assert metrics.suppression_counts["consent_absent"] >= 1
        assert metrics.retraction_count >= 1
        assert metrics.maximum_intent_latency_seconds >= 0
        assert metrics.state_inconsistency_count == 0

        session.execute(
            text("update identity.accounts set state = 'deleting' where account_id = :account_id"),
            {"account_id": account_id},
        )
        session.commit()
        deletion = EngagementRepository(session).delete_private_data(
            identity=_identity(account_id, state=AccountState.DELETING),
            idempotency_key="notification-private-delete",
            reason="notification-privacy-test",
            correlation_id=uuid4(),
        )
        assert deletion["notification_inbox_items_deleted"] >= 1
        assert deletion["notification_intents_deleted"] >= 1
        assert deletion["notification_digest_batches_deleted"] == 1
        assert (
            session.execute(
                text("select count(*) from notification.intents where account_id = :account_id"),
                {"account_id": account_id},
            ).scalar_one()
            == 0
        )
        assert (
            session.execute(
                text(
                    "select count(*) from notification.inbox_items where account_id = :account_id"
                ),
                {"account_id": account_id},
            ).scalar_one()
            == 0
        )


class _RecordingTransport:
    provider = "resend"

    def __init__(self) -> None:
        self.deliveries: list[tuple[UUID, str, str]] = []

    def send(
        self,
        *,
        delivery_id: UUID,
        to_email: str,
        rendered: object,
    ) -> ProviderDeliveryResult:
        self.deliveries.append((delivery_id, to_email, rendered.subject))
        return ProviderDeliveryResult(
            provider="resend",
            provider_message_id=f"provider-{delivery_id}",
            latency_ms=12,
        )


class _FailingTransport:
    provider = "resend"

    def send(
        self,
        *,
        delivery_id: UUID,
        to_email: str,
        rendered: object,
    ) -> ProviderDeliveryResult:
        del delivery_id, to_email, rendered
        raise NotificationTransportError(
            "resend_http_503",
            "temporary provider outage",
            retryable=True,
            latency_ms=25,
        )


def test_notification_delivery_worker_webhook_and_dlq_lifecycle(real_db_url: str) -> None:
    _ = real_db_url
    account_id = uuid4()
    identity = _identity(account_id)
    panda_id = "panda-notification-test"
    renderer = NotificationTemplateRenderer(public_base_url="https://zhipanda.example")

    with session_scope() as session:
        assert session is not None
        _insert_account(session, account_id)
        _insert_follow(session, account_id, panda_id)
        activity_id = _insert_activity(
            session,
            panda_id=panda_id,
            activity_type="panda.relocated",
            importance="important",
        )
        session.commit()
        notification = NotificationRepository(
            session,
            cursor_signing_key="notification-real-db-signing-key",
        )
        notification.set_preference(
            identity,
            category=NotificationCategory.MAJOR_ACTIVITY,
            channel=NotificationChannel.EMAIL,
            command=NotificationPreferenceCommand(
                enabled=True,
                idempotency_key="delivery-enable-major-email",
            ),
            correlation_id=uuid4(),
        )
        assert (
            notification.project(
                _activity_event(
                    activity_id,
                    activity_type="panda.relocated",
                    importance="important",
                )
            )["intent_count"]
            == 1
        )

        delivery = NotificationDeliveryRepository(session)
        assert delivery.relay_outbox(limit=20, email_enabled=True) == {
            "queued": 1,
            "suppressed": 0,
            "ignored": 0,
        }
        queued_payload = session.execute(
            text("select message from pgmq.q_notification_deliveries")
        ).scalar_one()
        assert set(queued_payload) == {
            "schema_version",
            "delivery_id",
            "source_event_id",
            "target_type",
            "target_id",
            "correlation_id",
        }
        assert "email" not in json.dumps(queued_payload)
        assert "content" not in json.dumps(queued_payload)

        paused = delivery.process_delivery_queue(
            transport=_RecordingTransport(),
            renderer=renderer,
            email_enabled=False,
            visibility_timeout_seconds=30,
            max_attempts=3,
            base_backoff_seconds=1,
            limit=10,
        )
        assert paused.paused == 1
        session.execute(
            text(
                "select pgmq.set_vt('notification_deliveries', msg_id, 0) "
                "from pgmq.q_notification_deliveries"
            )
        )
        session.commit()

        transport = _RecordingTransport()
        result = delivery.process_delivery_queue(
            transport=transport,
            renderer=renderer,
            email_enabled=True,
            visibility_timeout_seconds=30,
            max_attempts=3,
            base_backoff_seconds=1,
            limit=10,
        )
        assert result.submitted == 1
        assert result.delivered == 0
        assert len(transport.deliveries) == 1
        delivery_id = transport.deliveries[0][0]
        assert (
            session.execute(
                text(
                    "select attempt_number from notification.transport_attempts "
                    "where delivery_id = :delivery_id"
                ),
                {"delivery_id": delivery_id},
            ).scalar_one()
            == 1
        )
        provider_message_id = f"provider-{delivery_id}"
        assert (
            session.execute(
                text(
                    "select state::text from notification.delivery_jobs "
                    "where delivery_id = :delivery_id"
                ),
                {"delivery_id": delivery_id},
            ).scalar_one()
            == "submitted"
        )
        assert (
            session.execute(
                text("select count(*) from pgmq.q_notification_deliveries")
            ).scalar_one()
            == 0
        )

        delivered_body = json.dumps(
            {
                "type": "email.delivered",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {"email_id": provider_message_id},
            }
        ).encode()
        webhook_correlation = uuid4()
        assert (
            delivery.receive_resend_webhook(
                body=delivered_body,
                provider_event_id="provider-event-delivered",
                correlation_id=webhook_correlation,
            )
            == "queued"
        )
        assert (
            delivery.receive_resend_webhook(
                body=delivered_body,
                provider_event_id="provider-event-delivered",
                correlation_id=webhook_correlation,
            )
            == "duplicate"
        )
        conflicting_body = json.dumps(
            {
                "type": "email.failed",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {"email_id": provider_message_id},
            }
        ).encode()
        with pytest.raises(NotificationWebhookConflictError):
            delivery.receive_resend_webhook(
                body=conflicting_body,
                provider_event_id="provider-event-delivered",
                correlation_id=webhook_correlation,
            )
        assert (
            delivery.process_webhook_queue(
                visibility_timeout_seconds=30,
                max_attempts=3,
                base_backoff_seconds=1,
                limit=10,
            )["processed"]
            == 1
        )
        terminal = (
            session.execute(
                text(
                    """
                select job.state::text as job_state,
                       channel.delivery_state::text as channel_state,
                       attempt.state::text as attempt_state
                from notification.delivery_jobs job
                join notification.intent_channels channel
                  on channel.intent_id = job.intent_id and channel.channel = 'email'
                join notification.delivery_attempts attempt
                  on attempt.intent_id = job.intent_id and attempt.channel = 'email'
                where job.delivery_id = :delivery_id
                """
                ),
                {"delivery_id": delivery_id},
            )
            .mappings()
            .one()
        )
        assert terminal == {
            "job_state": "delivered",
            "channel_state": "delivered",
            "attempt_state": "delivered",
        }

        bounce_body = json.dumps(
            {
                "type": "email.bounced",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {
                    "email_id": provider_message_id,
                    "bounce_type": "Permanent",
                    "to": [identity.email],
                },
            }
        ).encode()
        assert (
            delivery.receive_resend_webhook(
                body=bounce_body,
                provider_event_id="provider-event-bounced",
                correlation_id=uuid4(),
            )
            == "queued"
        )
        assert (
            delivery.process_webhook_queue(
                visibility_timeout_seconds=30,
                max_attempts=3,
                base_backoff_seconds=1,
                limit=10,
            )["processed"]
            == 1
        )
        assert (
            session.execute(
                text(
                    "select reason from notification.email_suppressions "
                    "where account_id = :account_id"
                ),
                {"account_id": account_id},
            ).scalar_one()
            == "hard_bounce"
        )
        channel_states = (
            session.execute(
                text(
                    """
                select channel::text, enabled, delivery_state::text
                from notification.intent_channels channel
                join notification.intents intent on intent.intent_id = channel.intent_id
                where intent.account_id = :account_id
                """
                ),
                {"account_id": account_id},
            )
            .mappings()
            .all()
        )
        assert any(row["channel"] == "station" and row["enabled"] for row in channel_states)
        assert any(
            row["channel"] == "email" and row["delivery_state"] == "delivered"
            for row in channel_states
        )

        second_account_id = uuid4()
        second_identity = _identity(second_account_id)
        _insert_account(session, second_account_id)
        _insert_follow(session, second_account_id, panda_id)
        second_activity_id = _insert_activity(
            session,
            panda_id=panda_id,
            activity_type="panda.health_major",
            importance="important",
        )
        session.commit()
        notification.set_preference(
            second_identity,
            category=NotificationCategory.MAJOR_ACTIVITY,
            channel=NotificationChannel.EMAIL,
            command=NotificationPreferenceCommand(
                enabled=True,
                idempotency_key="delivery-enable-second-email",
            ),
            correlation_id=uuid4(),
        )
        assert (
            notification.project(
                _activity_event(
                    second_activity_id,
                    activity_type="panda.health_major",
                    importance="important",
                )
            )["intent_count"]
            == 2
        )
        assert delivery.relay_outbox(limit=20, email_enabled=True) == {
            "queued": 1,
            "suppressed": 1,
            "ignored": 0,
        }
        failure = delivery.process_delivery_queue(
            transport=_FailingTransport(),
            renderer=renderer,
            email_enabled=True,
            visibility_timeout_seconds=30,
            max_attempts=1,
            base_backoff_seconds=1,
            limit=10,
        )
        assert failure.dead_lettered >= 1
        dlq_messages = (
            session.execute(text("select message from pgmq.q_notification_deliveries_dlq"))
            .scalars()
            .all()
        )
        assert dlq_messages
        assert all("email" not in json.dumps(message) for message in dlq_messages)
        assert all("content" not in json.dumps(message) for message in dlq_messages)
        failed_delivery_id = session.execute(
            text(
                """
                select delivery_id
                from notification.delivery_jobs
                where account_id = :account_id and state = 'dead_lettered'
                """
            ),
            {"account_id": second_account_id},
        ).scalar_one()
        delivery.requeue_delivery(failed_delivery_id, correlation_id=uuid4())
        replay_state = session.execute(
            text(
                """
                select state::text, attempt_count, attempt_cycle_start
                from notification.delivery_jobs
                where delivery_id = :delivery_id
                """
            ),
            {"delivery_id": failed_delivery_id},
        ).one()
        assert tuple(replay_state) == ("queued", 1, 1)
        replay_transport = _RecordingTransport()
        replay = delivery.process_delivery_queue(
            transport=replay_transport,
            renderer=renderer,
            email_enabled=True,
            visibility_timeout_seconds=30,
            max_attempts=1,
            base_backoff_seconds=1,
            limit=10,
        )
        assert replay.submitted == 1
        assert replay_transport.deliveries[0][0] == failed_delivery_id
        attempt_numbers = (
            session.execute(
                text(
                    """
                select attempt_number
                from notification.transport_attempts
                where delivery_id = :delivery_id
                order by attempt_number
                """
                ),
                {"delivery_id": failed_delivery_id},
            )
            .scalars()
            .all()
        )
        assert attempt_numbers == [1, 2]
        replay_provider_message_id = f"provider-{failed_delivery_id}"
        replay_bounce = json.dumps(
            {
                "type": "email.bounced",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {
                    "email_id": replay_provider_message_id,
                    "bounce_type": "Permanent",
                },
            }
        ).encode()
        assert (
            delivery.receive_resend_webhook(
                body=replay_bounce,
                provider_event_id="provider-event-replay-bounced",
                correlation_id=uuid4(),
            )
            == "queued"
        )
        assert (
            delivery.process_webhook_queue(
                visibility_timeout_seconds=30,
                max_attempts=3,
                base_backoff_seconds=1,
                limit=10,
            )["processed"]
            == 1
        )
        assert (
            session.execute(
                text(
                    "select state::text from notification.delivery_jobs "
                    "where delivery_id = :delivery_id"
                ),
                {"delivery_id": failed_delivery_id},
            ).scalar_one()
            == "failed"
        )
        late_delivered = json.dumps(
            {
                "type": "email.delivered",
                "created_at": datetime.now(UTC).isoformat(),
                "data": {"email_id": replay_provider_message_id},
            }
        ).encode()
        assert (
            delivery.receive_resend_webhook(
                body=late_delivered,
                provider_event_id="provider-event-replay-late-delivered",
                correlation_id=uuid4(),
            )
            == "queued"
        )
        assert (
            delivery.process_webhook_queue(
                visibility_timeout_seconds=30,
                max_attempts=3,
                base_backoff_seconds=1,
                limit=10,
            )["processed"]
            == 1
        )
        assert (
            session.execute(
                text(
                    "select state::text from notification.delivery_jobs "
                    "where delivery_id = :delivery_id"
                ),
                {"delivery_id": failed_delivery_id},
            ).scalar_one()
            == "failed"
        )

        session.execute(
            text("select pgmq.send('notification_deliveries', cast(:message as jsonb))"),
            {"message": json.dumps({"email": "must-not-reach-dlq@example.invalid"})},
        )
        session.commit()
        malformed = delivery.process_delivery_queue(
            transport=_RecordingTransport(),
            renderer=renderer,
            email_enabled=True,
            visibility_timeout_seconds=30,
            max_attempts=3,
            base_backoff_seconds=1,
            limit=10,
        )
        assert malformed.dead_lettered == 1
        latest_dlq = session.execute(
            text(
                "select message from pgmq.q_notification_deliveries_dlq "
                "order by msg_id desc limit 1"
            )
        ).scalar_one()
        assert latest_dlq["failure_code"] == "invalid_delivery_job"
        assert "must-not-reach-dlq" not in json.dumps(latest_dlq)
        metrics = delivery.transport_metrics(
            queue_alert_depth=1,
            queue_alert_age_seconds=1,
        )
        assert metrics["dead_letter_count"] >= 1
        assert metrics["provider_error_count"] >= 1
        assert metrics["bounce_count"] == 2
        assert metrics["queue_depths"]["notification_deliveries_dlq"] >= 1
        assert any(alert.startswith("queue_depth:") for alert in metrics["alerts"])

        session.execute(
            text("update identity.accounts set state = 'deleting' where account_id = :account_id"),
            {"account_id": account_id},
        )
        session.commit()
        deletion = EngagementRepository(session).delete_private_data(
            identity=_identity(account_id, state=AccountState.DELETING),
            idempotency_key="notification-delivery-private-delete",
            reason="notification-delivery-privacy-test",
            correlation_id=uuid4(),
        )
        assert deletion["notification_transport_attempts_deleted"] >= 1
        assert deletion["notification_delivery_jobs_deleted"] >= 1
        assert deletion["notification_email_suppressions_deleted"] == 1
