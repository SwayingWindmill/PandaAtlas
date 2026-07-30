from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.integration.events import IntegrationEventEnvelope


class NotificationCategory(StrEnum):
    BIRTHDAY = "birthday"
    MAJOR_ACTIVITY = "major_activity"
    SUBMISSION_STATUS = "submission_status"
    INCORPORATION = "incorporation"
    CORRECTION_RETRACTION = "correction_retraction"
    SECURITY_ROLE = "security_role"


class NotificationChannel(StrEnum):
    STATION = "station"
    EMAIL = "email"
    WEB_PUSH = "web_push"


class NotificationIntentState(StrEnum):
    ACTIVE = "active"
    RETRACTED = "retracted"


class NotificationDeliveryState(StrEnum):
    PENDING = "pending"
    SUPPRESSED = "suppressed"
    QUEUED = "queued"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRACTED = "retracted"


class DigestFrequency(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"


class DigestState(StrEnum):
    BUILDING = "building"
    QUEUED = "queued"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRACTED = "retracted"


@dataclass(frozen=True, slots=True)
class NotificationClassification:
    category: NotificationCategory
    mandatory: bool
    default_channels: tuple[NotificationChannel, ...]


class NotificationPolicy:
    """Approved event-to-category and default-channel policy."""

    _SECURITY_TYPES = frozenset(
        {
            "identity.security.changed",
            "identity.role.assigned",
            "identity.role.revoked",
        }
    )
    _SUBMISSION_TYPES = frozenset(
        {
            "submission.status.changed",
            "contribution.submission_status.changed",
        }
    )
    _CONTRIBUTOR_STATUS_TYPE = "community.submission.contributor_status_changed"
    _INCORPORATION_STATUSES = frozenset(
        {
            "incorporation_in_progress",
            "incorporated_full",
            "incorporated_partial",
        }
    )
    _INCORPORATION_TYPES = frozenset(
        {
            "contribution.incorporated",
            "submission.incorporated",
        }
    )

    @classmethod
    def classify(
        cls,
        event: IntegrationEventEnvelope,
    ) -> NotificationClassification | None:
        if event.event_type in cls._SECURITY_TYPES:
            return NotificationClassification(
                category=NotificationCategory.SECURITY_ROLE,
                mandatory=True,
                default_channels=(
                    NotificationChannel.STATION,
                    NotificationChannel.EMAIL,
                ),
            )
        if event.event_type == cls._CONTRIBUTOR_STATUS_TYPE:
            status = str(event.payload.get("status", ""))
            category = (
                NotificationCategory.INCORPORATION
                if status in cls._INCORPORATION_STATUSES
                else NotificationCategory.SUBMISSION_STATUS
            )
            return NotificationClassification(
                category=category,
                mandatory=False,
                default_channels=(NotificationChannel.STATION,),
            )
        if event.event_type in cls._SUBMISSION_TYPES:
            return NotificationClassification(
                category=NotificationCategory.SUBMISSION_STATUS,
                mandatory=False,
                default_channels=(NotificationChannel.STATION,),
            )
        if event.event_type in cls._INCORPORATION_TYPES:
            return NotificationClassification(
                category=NotificationCategory.INCORPORATION,
                mandatory=False,
                default_channels=(NotificationChannel.STATION,),
            )
        if not event.event_type.startswith("activity.item."):
            return None
        if event.event_type == "activity.item.updated":
            return None
        if not bool(event.payload.get("notification_eligible", False)):
            return None
        activity_type = str(event.payload.get("activity_type", ""))
        if event.event_type in {"activity.item.corrected", "activity.item.retracted"}:
            category = NotificationCategory.CORRECTION_RETRACTION
        elif activity_type == "panda.birthday":
            category = NotificationCategory.BIRTHDAY
        else:
            category = NotificationCategory.MAJOR_ACTIVITY
        return NotificationClassification(
            category=category,
            mandatory=False,
            default_channels=(NotificationChannel.STATION,),
        )


class InboxItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    inbox_item_id: UUID
    intent_id: UUID
    category: NotificationCategory
    body: dict[str, object]
    body_version: int = Field(ge=1)
    created_at: datetime
    expires_at: datetime
    seen_at: datetime | None
    read_at: datetime | None
    retracted_at: datetime | None
    retraction_reason: str | None


class InboxPage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[InboxItem]
    next_cursor: str | None
    unread_count: int = Field(ge=0)


class InboxUnreadCount(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    unread_count: int = Field(ge=0)


class InboxMarkCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)


class NotificationPreferenceCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    enabled: bool
    idempotency_key: str = Field(min_length=8, max_length=255)


class NotificationPreferenceState(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    account_id: UUID
    category: NotificationCategory
    channel: NotificationChannel
    enabled: bool
    version: int = Field(ge=1)
    updated_at: datetime


class DeliveryAttemptCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    state: NotificationDeliveryState
    provider: str | None = Field(default=None, min_length=1, max_length=120)
    provider_message_id: str | None = Field(default=None, min_length=1, max_length=500)
    failure_code: str | None = Field(default=None, min_length=1, max_length=120)
    failure_detail: str | None = Field(default=None, min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validate_terminal_state(self) -> DeliveryAttemptCommand:
        if self.state not in {
            NotificationDeliveryState.DELIVERED,
            NotificationDeliveryState.FAILED,
        }:
            raise ValueError("delivery attempt state must be delivered or failed")
        if self.state is NotificationDeliveryState.DELIVERED:
            if self.provider_message_id is None:
                raise ValueError("delivered attempts require provider_message_id")
            if self.failure_code is not None or self.failure_detail is not None:
                raise ValueError("delivered attempts cannot include failure details")
        elif self.failure_code is None:
            raise ValueError("failed attempts require failure_code")
        return self


class DeliveryAttempt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    attempt_id: UUID
    intent_id: UUID
    channel: NotificationChannel
    attempt_number: int = Field(ge=1)
    state: NotificationDeliveryState
    provider: str | None
    provider_message_id: str | None
    failure_code: str | None
    failure_detail: str | None
    attempted_at: datetime
    correlation_id: UUID


class DigestQueueCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    frequency: DigestFrequency
    period_start: datetime
    period_end: datetime
    locale: str = Field(pattern=r"^(zh-CN|en)$")
    idempotency_key: str = Field(min_length=8, max_length=255)

    @field_validator("period_start", "period_end")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        _require_aware(value, "digest period")
        return value


class DigestBatch(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    batch_id: UUID
    account_id: UUID
    frequency: DigestFrequency
    state: DigestState
    content: dict[str, object]
    content_version: int = Field(ge=1)
    period_start: datetime
    period_end: datetime
    queued_at: datetime | None
    created_at: datetime


class NotificationMetricsSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    intent_created_count: int
    suppression_counts: dict[str, int]
    unread_count: int
    maximum_intent_latency_seconds: float
    retraction_count: int
    state_inconsistency_count: int
    queue_depths: dict[str, int] = Field(default_factory=dict)
    oldest_queue_message_age_seconds: dict[str, float] = Field(default_factory=dict)
    retry_count: int = 0
    dead_letter_count: int = 0
    maximum_provider_latency_seconds: float = 0
    provider_error_count: int = 0
    bounce_count: int = 0
    complaint_count: int = 0
    webhook_verification_failure_count: int = 0
    alerts: list[str] = Field(default_factory=list)


class NotificationWebhookReceipt(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: str = Field(pattern=r"^(queued|duplicate)$")
    provider_event_id: str = Field(min_length=1, max_length=500)


class InboxCursorError(ValueError):
    """Raised when an Inbox cursor is invalid or reused by another account."""


def encode_inbox_cursor(
    *,
    created_at: datetime,
    inbox_item_id: UUID,
    account_id: UUID,
    signing_key: str,
) -> str:
    _require_aware(created_at, "created_at")
    payload = json.dumps(
        {
            "account_id": str(account_id),
            "created_at": created_at.astimezone(UTC).isoformat(),
            "inbox_item_id": str(inbox_item_id),
            "version": 1,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    signature = hmac.new(signing_key.encode(), encoded.encode("ascii"), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"{encoded}.{encoded_signature}"


def decode_inbox_cursor(
    cursor: str,
    *,
    account_id: UUID,
    signing_key: str,
) -> tuple[datetime, UUID]:
    try:
        encoded, encoded_signature = cursor.split(".", 1)
        expected_signature = hmac.new(
            signing_key.encode(),
            encoded.encode("ascii"),
            hashlib.sha256,
        ).digest()
        supplied_signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise InboxCursorError("invalid Inbox cursor")
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode())
        if payload.get("version") != 1 or payload.get("account_id") != str(account_id):
            raise InboxCursorError("Inbox cursor scope does not match")
        created_at = datetime.fromisoformat(payload["created_at"])
        inbox_item_id = UUID(payload["inbox_item_id"])
    except InboxCursorError:
        raise
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise InboxCursorError("invalid Inbox cursor") from error
    _require_aware(created_at, "cursor created_at")
    return created_at, inbox_item_id


def _require_aware(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must include a timezone")
