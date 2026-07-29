from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID, uuid5

from pydantic import BaseModel, ConfigDict, Field, model_validator

_ACTIVITY_NAMESPACE = UUID("27e7cdd9-4507-42f3-83d1-108fd522e7d3")
_SOURCE_ID_PATTERN = r"^[a-z0-9][a-z0-9:._-]{2,254}$"
_LOCALIZATION_KEY_PATTERN = r"^[a-z][a-z0-9_.-]{2,127}$"


class ActivityType(StrEnum):
    PANDA_BIRTH = "panda.birth"
    PANDA_DEATH = "panda.death"
    PANDA_NAMED = "panda.named"
    PANDA_RELOCATED = "panda.relocated"
    PANDA_BIRTHDAY = "panda.birthday"
    PANDA_HEALTH_MAJOR = "panda.health_major"
    ARCHIVE_PROFILE_CORRECTED = "archive.profile_corrected"
    EDITORIAL_ANNOUNCEMENT = "editorial.announcement"


class ActivityAction(StrEnum):
    PUBLISH = "publish"
    SNAPSHOT_UPDATE = "snapshot_update"
    CORRECTION = "correction"
    RETRACTION = "retraction"


class ActivityImportance(StrEnum):
    ORDINARY = "ordinary"
    IMPORTANT = "important"
    CRITICAL = "critical"


class ActivityVisibility(StrEnum):
    PUBLIC = "public"
    UNLISTED = "unlisted"


class RetractionState(StrEnum):
    ACTIVE = "active"
    CORRECTED = "corrected"
    RETRACTED = "retracted"


class ProjectionOutcome(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    CORRECTED = "corrected"
    RETRACTED = "retracted"
    DUPLICATE = "duplicate"


class OccurrencePrecision(StrEnum):
    EXACT = "exact"
    DAY = "day"
    MONTH = "month"
    YEAR = "year"
    RANGE = "range"
    UNKNOWN = "unknown"


class ActivityTarget(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    target_type: Literal["panda", "institution"]
    target_id: str = Field(min_length=1, max_length=200)


class LocalizedActivitySnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    locale: str = Field(min_length=2, max_length=20)
    title: str = Field(min_length=1, max_length=240)
    summary: str = Field(min_length=1, max_length=2000)
    fallback_from_locale: str | None = Field(default=None, min_length=2, max_length=20)


class ActivityMediaReference(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    asset_id: UUID
    variant: str = Field(min_length=1, max_length=80)
    alt_text: str = Field(min_length=1, max_length=500)


class ActivityProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    release_id: UUID | None = None
    data_version: str | None = Field(default=None, min_length=1, max_length=120)
    public_schema_version: str | None = Field(default=None, min_length=1, max_length=40)
    projection_code_version: str | None = Field(default=None, min_length=1, max_length=200)
    public_reference_ids: list[str] = Field(default_factory=list, max_length=100)


class ActivityPin(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    starts_at: datetime
    ends_at: datetime
    reason: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_window(self) -> ActivityPin:
        _require_aware(self.starts_at, "pin starts_at")
        _require_aware(self.ends_at, "pin ends_at")
        if self.ends_at <= self.starts_at:
            raise ValueError("pin ends_at must be after starts_at")
        return self


_DEFAULT_IMPORTANCE: dict[ActivityType, ActivityImportance] = {
    ActivityType.PANDA_BIRTH: ActivityImportance.CRITICAL,
    ActivityType.PANDA_DEATH: ActivityImportance.CRITICAL,
    ActivityType.PANDA_NAMED: ActivityImportance.IMPORTANT,
    ActivityType.PANDA_RELOCATED: ActivityImportance.IMPORTANT,
    ActivityType.PANDA_BIRTHDAY: ActivityImportance.ORDINARY,
    ActivityType.PANDA_HEALTH_MAJOR: ActivityImportance.IMPORTANT,
    ActivityType.ARCHIVE_PROFILE_CORRECTED: ActivityImportance.IMPORTANT,
    ActivityType.EDITORIAL_ANNOUNCEMENT: ActivityImportance.ORDINARY,
}


class ActivityContent(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    activity_type: ActivityType
    targets: list[ActivityTarget] = Field(min_length=1, max_length=50)
    importance: ActivityImportance | None = None
    importance_override_reason: str | None = Field(default=None, min_length=1, max_length=1000)
    visibility: ActivityVisibility = ActivityVisibility.PUBLIC
    sitewide: bool = False
    notification_eligible: bool = True
    occurred_at: datetime
    occurred_precision: OccurrencePrecision = OccurrencePrecision.EXACT
    occurred_end_at: datetime | None = None
    localization_key: str = Field(
        min_length=3,
        max_length=128,
        pattern=_LOCALIZATION_KEY_PATTERN,
    )
    localization_version: int = Field(ge=1)
    localized_snapshots: list[LocalizedActivitySnapshot] = Field(min_length=1, max_length=20)
    media: ActivityMediaReference | None = None
    provenance: ActivityProvenance = Field(default_factory=ActivityProvenance)
    pin: ActivityPin | None = None

    @model_validator(mode="after")
    def validate_public_content(self) -> ActivityContent:
        _require_aware(self.occurred_at, "occurred_at")
        if self.occurred_end_at is not None:
            _require_aware(self.occurred_end_at, "occurred_end_at")
            if self.occurred_end_at < self.occurred_at:
                raise ValueError("occurred_end_at must not be before occurred_at")
            if self.occurred_precision != OccurrencePrecision.RANGE:
                raise ValueError("occurred_end_at requires range precision")
        elif self.occurred_precision == OccurrencePrecision.RANGE:
            raise ValueError("range precision requires occurred_end_at")

        if self.sitewide and self.visibility != ActivityVisibility.PUBLIC:
            raise ValueError("sitewide Activity must be public")
        if self.pin is not None and self.visibility != ActivityVisibility.PUBLIC:
            raise ValueError("pinned Activity must be public")

        target_keys = {(target.target_type, target.target_id) for target in self.targets}
        if len(target_keys) != len(self.targets):
            raise ValueError("activity targets must be unique")
        locales = [snapshot.locale for snapshot in self.localized_snapshots]
        if len(set(locales)) != len(locales):
            raise ValueError("localized activity snapshots must use unique locales")
        if "zh-CN" not in locales:
            raise ValueError("Simplified Chinese activity content is required")

        default_importance = _DEFAULT_IMPORTANCE[self.activity_type]
        if self.importance is not None and self.importance != default_importance:
            if self.importance_override_reason is None:
                raise ValueError("importance override requires a recorded reason")
        elif self.importance_override_reason is not None:
            raise ValueError("importance override reason requires a non-default importance")
        return self

    @property
    def effective_importance(self) -> ActivityImportance:
        return self.importance or _DEFAULT_IMPORTANCE[self.activity_type]


class ArchiveActivityDescriptor(ActivityContent):
    source_id: str = Field(min_length=3, max_length=255, pattern=_SOURCE_ID_PATTERN)
    action: ActivityAction = ActivityAction.PUBLISH
    retraction_reason: str | None = Field(default=None, min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validate_action(self) -> ArchiveActivityDescriptor:
        if self.activity_type == ActivityType.EDITORIAL_ANNOUNCEMENT:
            raise ValueError("Archive releases cannot impersonate editorial announcements")
        if self.sitewide:
            raise ValueError("Archive Activity cannot request sitewide distribution")
        if self.pin is not None:
            raise ValueError("Archive Activity cannot create editorial pins")
        if self.action == ActivityAction.CORRECTION:
            if self.activity_type != ActivityType.ARCHIVE_PROFILE_CORRECTED:
                raise ValueError("correction activity must use archive.profile_corrected")
        elif (
            self.action == ActivityAction.PUBLISH
            and self.activity_type == ActivityType.ARCHIVE_PROFILE_CORRECTED
        ):
            raise ValueError("archive.profile_corrected cannot be an initial publication")
        if self.action == ActivityAction.RETRACTION:
            if self.retraction_reason is None:
                raise ValueError("retraction requires a public-safe reason")
        elif self.retraction_reason is not None:
            raise ValueError("retraction_reason is valid only for retraction action")
        return self


class ActivitySourceEvent(ActivityContent):
    event_id: UUID
    source_type: Literal["archive.release", "editorial.announcement"]
    source_id: str = Field(min_length=3, max_length=255, pattern=_SOURCE_ID_PATTERN)
    source_version: int = Field(ge=1)
    action: ActivityAction
    published_at: datetime
    retraction_reason: str | None = Field(default=None, min_length=1, max_length=2000)
    correlation_id: UUID
    causation_id: UUID | None = None
    is_backfill: bool = False

    @model_validator(mode="after")
    def validate_event(self) -> ActivitySourceEvent:
        _require_aware(self.published_at, "published_at")
        if self.action == ActivityAction.CORRECTION:
            if self.activity_type != ActivityType.ARCHIVE_PROFILE_CORRECTED:
                raise ValueError("correction activity must use archive.profile_corrected")
        elif (
            self.action == ActivityAction.PUBLISH
            and self.activity_type == ActivityType.ARCHIVE_PROFILE_CORRECTED
        ):
            raise ValueError("archive.profile_corrected cannot be an initial publication")
        if self.action == ActivityAction.RETRACTION:
            if self.retraction_reason is None:
                raise ValueError("retraction requires a public-safe reason")
        elif self.retraction_reason is not None:
            raise ValueError("retraction_reason is valid only for retraction action")
        return self


class EditorialAnnouncementCommand(ActivityContent):
    command_id: UUID
    source_id: str = Field(min_length=3, max_length=255, pattern=_SOURCE_ID_PATTERN)
    correlation_id: UUID
    reason: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validate_editorial_type(self) -> EditorialAnnouncementCommand:
        if self.activity_type != ActivityType.EDITORIAL_ANNOUNCEMENT:
            raise ValueError("editorial command must use editorial.announcement")
        return self


class ActivityItem(ActivityContent):
    activity_id: UUID
    source_type: str
    source_id: str
    source_version: int
    source_event_id: UUID
    published_at: datetime
    updated_at: datetime
    retraction_state: RetractionState
    retracted_at: datetime | None = None
    retraction_reason: str | None = None
    correction_activity_id: UUID | None = None
    is_backfill: bool = False


class ActivityProjectionResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    outcome: ProjectionOutcome
    activity_id: UUID
    source_event_id: UUID


class ActivityPage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[ActivityItem]
    next_cursor: str | None


class ActivityRebuildResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source_events: int
    created_items: int
    updated_items: int
    corrected_items: int
    retracted_items: int


class ActivityProjectionMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    projected_events: int
    replayed_events: int
    backfilled_events: int
    failed_events: int
    maximum_projection_lag_seconds: float
    event_type_counts: dict[str, int]


class ActivityConflictError(RuntimeError):
    """Raised when an Activity source version conflicts with projected state."""


class ActivitySourceNotFoundError(LookupError):
    """Raised when a correction, update, or retraction has no projected source."""


def activity_id_for(event: ActivitySourceEvent) -> UUID:
    if event.action not in {ActivityAction.PUBLISH, ActivityAction.CORRECTION}:
        raise ValueError("only publish and correction events create Activity IDs")
    value = f"{event.source_type}|{event.source_id}|{event.source_version}"
    return uuid5(_ACTIVITY_NAMESPACE, value)


def encode_activity_cursor(published_at: datetime, activity_id: UUID) -> str:
    _require_aware(published_at, "published_at")
    payload = json.dumps(
        {"published_at": published_at.astimezone(UTC).isoformat(), "activity_id": str(activity_id)},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_activity_cursor(cursor: str) -> tuple[datetime, UUID]:
    padding = "=" * (-len(cursor) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(cursor + padding).decode("utf-8"))
        published_at = datetime.fromisoformat(payload["published_at"])
        activity_id = UUID(payload["activity_id"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError("invalid Activity cursor") from error
    _require_aware(published_at, "cursor published_at")
    return published_at, activity_id


def _require_aware(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must include a timezone")
