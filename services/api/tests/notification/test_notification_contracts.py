from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.integration.events import AggregateReference, IntegrationEventEnvelope
from app.notification.models import (
    DeliveryAttemptCommand,
    InboxCursorError,
    NotificationCategory,
    NotificationChannel,
    NotificationDeliveryState,
    NotificationPolicy,
    decode_inbox_cursor,
    encode_inbox_cursor,
)


def _event(event_type: str, payload: dict[str, object]) -> IntegrationEventEnvelope:
    return IntegrationEventEnvelope(
        event_type=event_type,
        source_context="activity",
        aggregate=AggregateReference(type="activity_item", id=str(uuid4()), version=1),
        idempotency_key=f"event-{uuid4()}",
        correlation_id=uuid4(),
        payload=payload,
    )


def test_activity_policy_maps_approved_categories() -> None:
    birthday = NotificationPolicy.classify(
        _event(
            "activity.item.published",
            {
                "activity_id": str(uuid4()),
                "activity_type": "panda.birthday",
                "importance": "ordinary",
                "notification_eligible": True,
                "target_panda_ids": ["panda-1"],
            },
        )
    )
    major = NotificationPolicy.classify(
        _event(
            "activity.item.published",
            {
                "activity_id": str(uuid4()),
                "activity_type": "panda.relocated",
                "importance": "important",
                "notification_eligible": True,
                "target_panda_ids": ["panda-1"],
            },
        )
    )
    correction = NotificationPolicy.classify(
        _event(
            "activity.item.corrected",
            {
                "activity_id": str(uuid4()),
                "activity_type": "archive.profile_corrected",
                "importance": "important",
                "notification_eligible": True,
                "target_panda_ids": ["panda-1"],
            },
        )
    )

    assert birthday is not None
    assert birthday.category is NotificationCategory.BIRTHDAY
    assert major is not None
    assert major.category is NotificationCategory.MAJOR_ACTIVITY
    assert correction is not None
    assert correction.category is NotificationCategory.CORRECTION_RETRACTION


def test_policy_separates_optional_email_from_mandatory_security() -> None:
    activity = NotificationPolicy.classify(
        _event(
            "activity.item.published",
            {
                "activity_id": str(uuid4()),
                "activity_type": "panda.death",
                "importance": "critical",
                "notification_eligible": True,
                "target_panda_ids": ["panda-1"],
            },
        )
    )
    security = NotificationPolicy.classify(
        IntegrationEventEnvelope(
            event_type="identity.security.changed",
            source_context="identity",
            aggregate=AggregateReference(type="account", id=str(uuid4()), version=2),
            idempotency_key=f"security-{uuid4()}",
            correlation_id=uuid4(),
            payload={"account_id": str(uuid4()), "reason": "passwordless-session-revoked"},
        )
    )

    assert activity is not None
    assert activity.mandatory is False
    assert activity.default_channels == (NotificationChannel.STATION,)
    assert security is not None
    assert security.category is NotificationCategory.SECURITY_ROLE
    assert security.mandatory is True
    assert security.default_channels == (
        NotificationChannel.STATION,
        NotificationChannel.EMAIL,
    )


def test_inbox_cursor_is_account_bound_and_signed() -> None:
    account_id = uuid4()
    created_at = datetime(2026, 7, 30, 2, 0, tzinfo=UTC)
    item_id = uuid4()
    cursor = encode_inbox_cursor(
        created_at=created_at,
        inbox_item_id=item_id,
        account_id=account_id,
        signing_key="notification-contract-secret",
    )

    assert decode_inbox_cursor(
        cursor,
        account_id=account_id,
        signing_key="notification-contract-secret",
    ) == (created_at, item_id)
    with pytest.raises(InboxCursorError):
        decode_inbox_cursor(
            cursor,
            account_id=uuid4(),
            signing_key="notification-contract-secret",
        )


def test_delivery_attempt_requires_terminal_consistent_result() -> None:
    delivered = DeliveryAttemptCommand(
        idempotency_key="delivery-attempt-1",
        state=NotificationDeliveryState.DELIVERED,
        provider="mailer",
        provider_message_id="message-1",
    )
    failed = DeliveryAttemptCommand(
        idempotency_key="delivery-attempt-2",
        state=NotificationDeliveryState.FAILED,
        provider="mailer",
        failure_code="temporary-error",
    )

    assert delivered.state is NotificationDeliveryState.DELIVERED
    assert failed.state is NotificationDeliveryState.FAILED
    with pytest.raises(ValueError):
        DeliveryAttemptCommand(
            idempotency_key="delivery-attempt-3",
            state=NotificationDeliveryState.DELIVERED,
            provider="mailer",
        )
    with pytest.raises(ValueError):
        DeliveryAttemptCommand(
            idempotency_key="delivery-attempt-4",
            state=NotificationDeliveryState.PENDING,
        )
