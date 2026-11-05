"""Core records shared by adapters, the store and the scheduler."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

JsonDict = dict[str, Any]


class TargetKind(StrEnum):
    ACCOUNT = "account"
    KEYWORD = "keyword"
    FEED = "feed"


class Tier(StrEnum):
    """Collection tier. It decides the default interval and how AIHOT should weigh the source."""

    OFFICIAL = "official"
    KEY_ACCOUNT = "key_account"
    KEYWORD = "keyword"
    BACKFILL = "backfill"


DEFAULT_INTERVAL_MINUTES: dict[Tier, int] = {
    Tier.OFFICIAL: 15,
    Tier.KEY_ACCOUNT: 90,
    Tier.KEYWORD: 180,
    Tier.BACKFILL: 1440,
}


@dataclass(frozen=True)
class Target:
    id: str
    adapter: str
    kind: TargetKind
    value: str
    label: str
    tier: Tier
    interval_minutes: int
    params: JsonDict = field(default_factory=dict)


@dataclass(frozen=True)
class Item:
    """One piece of platform content, normalized but with the untouched payload kept in `raw`."""

    platform: str
    platform_item_id: str
    url: str
    title: str
    body: str = ""
    author_id: str | None = None
    author_name: str | None = None
    published_at: datetime | None = None
    media: list[JsonDict] = field(default_factory=list)
    metrics: JsonDict = field(default_factory=dict)
    raw: JsonDict = field(default_factory=dict)

    def content_hash(self) -> str:
        """Hash of what makes a new version. Counters and media URLs are left out: platforms sign
        media URLs per request, so hashing them would turn every run into an edit."""
        payload = json.dumps(
            [self.title, self.body, [m.get("type") for m in self.media]], ensure_ascii=False
        )
        return hashlib.sha256(payload.encode()).hexdigest()


@dataclass(frozen=True)
class Page:
    items: list[Item]
    #: Adapter-defined state stored on the target and handed back on the next run.
    cursor: JsonDict | None = None
    #: How many entries the platform returned, when an adapter drops known ones from `items`.
    seen: int | None = None
    #: The source answered "not modified" (HTTP 304); that is not an empty result.
    not_modified: bool = False

    @property
    def empty(self) -> bool:
        return (
            not self.not_modified and (self.seen if self.seen is not None else len(self.items)) == 0
        )


class ErrorKind(StrEnum):
    LOGIN_EXPIRED = "login_expired"
    RATE_LIMITED = "rate_limited"
    CHALLENGE = "challenge"
    UPSTREAM_CHANGED = "upstream_changed"
    NOT_FOUND = "not_found"
    TRANSIENT = "transient"


class CollectError(Exception):
    """A classified failure. The scheduler decides pausing, backoff and alerting from `kind`."""

    def __init__(self, kind: ErrorKind, message: str, *, retry_after_seconds: int | None = None):
        super().__init__(message)
        self.kind = kind
        self.retry_after_seconds = retry_after_seconds


#: Failures that mean every target of the adapter will fail, so the adapter pauses as a whole.
ADAPTER_WIDE: dict[ErrorKind, int] = {
    ErrorKind.LOGIN_EXPIRED: 6 * 3600,
    ErrorKind.CHALLENGE: 6 * 3600,
    ErrorKind.RATE_LIMITED: 30 * 60,
}
