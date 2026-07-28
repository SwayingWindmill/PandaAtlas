from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class PendingFollowStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class PendingFollowOutcome(StrEnum):
    FOLLOWED = "followed"
    ALREADY_FOLLOWED = "already_followed"
    CANCELLED = "cancelled"
    INTENT_EXPIRED = "intent_expired"


class FollowState(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class NotificationChannel(StrEnum):
    STATION = "station"
    EMAIL = "email"
    WEB_PUSH = "web_push"


@dataclass(frozen=True, slots=True)
class PendingFollowHandle:
    intent_id: UUID
    handle: str
    continuation_handle: str
    panda_id: str
    locale: str
    safe_return_path: str
    status: PendingFollowStatus
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class PendingFollowResult:
    intent_id: UUID
    panda_id: str
    status: PendingFollowStatus
    outcome: PendingFollowOutcome
    follow_id: UUID | None
    follow_state: FollowState | None
    first_followed_at: datetime | None
    followed_at: datetime | None
    version: int | None


class EngagementAccountUnavailableError(PermissionError):
    """Raised when an account cannot accept an Engagement write."""


class EngagementConflictError(RuntimeError):
    """Raised when an engagement command conflicts with durable state."""


class EngagementNotFoundError(LookupError):
    """Raised when an opaque handle or relationship does not resolve."""
