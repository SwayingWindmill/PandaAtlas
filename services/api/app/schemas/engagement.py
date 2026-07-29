from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.engagement.models import (
    FollowState,
    NotificationChannel,
    PendingFollowOutcome,
    PendingFollowStatus,
)


class PendingFollowCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: str = Field(min_length=1, max_length=255)
    locale: str = Field(pattern=r"^(zh|en)$")
    return_path: str = Field(min_length=1, max_length=500)
    existing_handle: str | None = Field(default=None, max_length=512)
    request_id: UUID

    @field_validator("return_path")
    @classmethod
    def validate_return_path(cls, value: str) -> str:
        if not value.startswith("/") or value.startswith("//") or "\\" in value:
            raise ValueError("return_path must be a safe internal path")
        return value


class PendingFollowHandleRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent_id: UUID
    handle: str
    continuation_handle: str
    panda_id: str
    locale: str
    safe_return_path: str
    status: PendingFollowStatus
    expires_at: datetime


class PendingFollowHandleCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    handle: str = Field(min_length=20, max_length=512)
    idempotency_key: str = Field(min_length=8, max_length=255)


class PendingFollowCurrentRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent_id: UUID
    panda_id: str
    locale: str
    safe_return_path: str
    status: PendingFollowStatus
    outcome: PendingFollowOutcome | None
    expires_at: datetime


class FollowCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=255)


class FollowRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    follow_id: UUID
    panda_id: str
    state: FollowState
    first_followed_at: datetime
    followed_at: datetime
    unfollowed_at: datetime | None
    version: int


class PendingFollowCompletionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent_id: UUID
    panda_id: str
    status: PendingFollowStatus
    outcome: PendingFollowOutcome
    follow: FollowRead | None


class NotificationPreferenceChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool
    idempotency_key: str = Field(min_length=8, max_length=255)


class NotificationPreferenceRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    channel: NotificationChannel
    enabled: bool
    version: int
    updated_at: datetime


class PassportEntryRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: str
    relationship_state: FollowState | None
    first_followed_at: datetime | None
    followed_at: datetime | None
    unfollowed_at: datetime | None
    contribution_count: int
    projection_version: int
    projected_at: datetime


class PassportRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    entries: list[PassportEntryRead]
    rebuilt: bool = False


class EngagementDataDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(default="account-deletion", min_length=3, max_length=200)


class EngagementDataDeleteRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    follows_deleted: int
    preferences_deleted: int
    passport_entries_deleted: int
    contribution_events_deleted: int
    last_viewed_deleted: int
    outcome: str
