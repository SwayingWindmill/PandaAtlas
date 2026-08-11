from __future__ import annotations

from datetime import date, datetime
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


class FavoriteRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: str
    favorited_at: datetime


class FavoriteRemovedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: str
    favorited: bool = False
    favorited_at: datetime | None = None


class FavoritesRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[FavoriteRead]


class CollectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)


class CollectionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)


class CollectionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    collection_id: UUID
    name: str
    panda_ids: list[str]
    created_at: datetime
    updated_at: datetime


class CollectionsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[CollectionRead]


class CollectionDeletedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    collection_id: UUID
    deleted: bool = True


class LocationCheckinCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    place_id: str = Field(min_length=1, max_length=255)
    visited_on: date
    note: str | None = Field(default=None, max_length=280)


class LocationCheckinRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkin_id: UUID
    place_id: str
    visited_on: date
    note: str | None
    created_at: datetime


class LocationCheckinsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[LocationCheckinRead]


class LocationCheckinDeletedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkin_id: UUID
    deleted: bool = True


class SeenPandaUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seen_on: date | None = None
    place_id: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=280)


class SeenPandaRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seen_id: UUID
    panda_id: str
    place_id: str | None
    seen_on: date | None
    note: str | None
    first_seen_at: datetime
    updated_at: datetime


class SeenPandasRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[SeenPandaRead]


class SeenPandaDeletedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: str
    deleted: bool = True


class GameAttemptCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_panda_id: str = Field(min_length=1, max_length=255)
    selected_panda_id: str = Field(min_length=1, max_length=255)
    public_release_version: str | None = Field(default=None, max_length=120)


class GameAttemptRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt_id: UUID
    game_type: str = Field(pattern="^guess_panda$")
    target_panda_id: str
    selected_panda_id: str
    correct: bool
    public_release_version: str | None
    attempted_at: datetime


class GameAttemptsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[GameAttemptRead]


class GameAttemptDeletedRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt_id: UUID
    deleted: bool = True


class EngagementDataDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")

    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(default="account-deletion", min_length=3, max_length=200)


class EngagementDataDeleteRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID
    follows_deleted: int
    collections_deleted: int
    location_checkins_deleted: int
    seen_pandas_deleted: int
    game_attempts_deleted: int
    preferences_deleted: int
    passport_entries_deleted: int
    contribution_events_deleted: int
    last_viewed_deleted: int
    outcome: str
