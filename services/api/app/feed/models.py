from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.activity.models import ActivityItem


class FeedAttribution(StrEnum):
    FOLLOWED = "followed"
    HISTORY = "history"
    PINNED = "pinned"


class FeedItem(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    activity: ActivityItem
    attribution: FeedAttribution
    followed_panda_ids: list[str] = Field(default_factory=list)
    is_pinned: bool = False
    is_new: bool = False
    deleted_target_ids: list[str] = Field(default_factory=list)


class FeedPage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[FeedItem]
    next_cursor: str | None
    last_viewed_at: datetime | None
    projection_stale: bool = False
    projection_lag_seconds: float = 0.0


class FeedLastViewedCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    viewed_through_at: datetime

    @field_validator("viewed_through_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        _require_aware(value, "viewed_through_at")
        return value


class FeedLastViewedState(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    account_id: UUID
    last_viewed_at: datetime
    version: int = Field(ge=1)
    updated_at: datetime


class FeedMetricsSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    query_count: int
    cursor_error_count: int
    empty_feed_count: int
    failed_page_load_count: int
    maximum_query_latency_ms: float
    maximum_projection_lag_seconds: float


class FeedCursorError(ValueError):
    """Raised when a Feed cursor is invalid or reused in another scope."""


def encode_feed_cursor(
    *,
    published_at: datetime,
    activity_id: UUID,
    scope: str,
    signing_key: str,
) -> str:
    _require_aware(published_at, "published_at")
    payload = json.dumps(
        {
            "activity_id": str(activity_id),
            "published_at": published_at.astimezone(UTC).isoformat(),
            "scope": scope,
            "version": 1,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    signature = hmac.new(signing_key.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256)
    encoded_signature = base64.urlsafe_b64encode(signature.digest()).decode("ascii").rstrip("=")
    return f"{encoded}.{encoded_signature}"


def decode_feed_cursor(
    cursor: str,
    *,
    expected_scope: str,
    signing_key: str,
) -> tuple[datetime, UUID]:
    try:
        encoded, encoded_signature = cursor.split(".", 1)
        expected_signature = hmac.new(
            signing_key.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256
        ).digest()
        supplied_signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise FeedCursorError("invalid Feed cursor")
        payload = json.loads(
            base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode("utf-8")
        )
        if payload.get("version") != 1:
            raise FeedCursorError("invalid Feed cursor")
        if payload.get("scope") != expected_scope:
            raise FeedCursorError("Feed cursor scope does not match")
        published_at = datetime.fromisoformat(payload["published_at"])
        activity_id = UUID(payload["activity_id"])
    except FeedCursorError:
        raise
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise FeedCursorError("invalid Feed cursor") from error
    _require_aware(published_at, "cursor published_at")
    return published_at, activity_id


def _require_aware(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must include a timezone")
