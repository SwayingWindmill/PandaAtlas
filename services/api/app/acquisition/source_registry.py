from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from hashlib import sha256
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_REGISTRY_PATH = _REPOSITORY_ROOT / "data" / "acquisition-sources" / "registry.json"
_HEX = set("0123456789abcdef")


class AccessStatus(StrEnum):
    APPROVED = "approved"
    PERMISSION_REQUIRED = "permission-required"
    MANUAL_REVIEW_REQUIRED = "manual-review-required"


@dataclass(frozen=True, slots=True)
class ReviewedSource:
    source_id: str
    label: str
    access_status: AccessStatus
    base_url: str | None
    allowed_hosts: tuple[str, ...]
    allowed_paths: tuple[str, ...]
    capability: str
    live_fetch: bool
    browser_impersonation: bool
    max_requests_per_minute: int
    concurrency_per_host: int
    media_reuse_policy: str
    terms_url: str | None
    robots_url: str | None
    policy_urls: tuple[str, ...]
    reviewed_at: date
    review_expires_at: date
    notes: tuple[str, ...]

    def assert_live_fetch_allowed(self) -> None:
        if self.access_status is not AccessStatus.APPROVED or not self.live_fetch:
            raise ValueError(f"source {self.source_id} is not approved for live automated fetch")

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "label": self.label,
            "access_status": self.access_status.value,
            "base_url": self.base_url,
            "allowed_hosts": list(self.allowed_hosts),
            "allowed_paths": list(self.allowed_paths),
            "capability": self.capability,
            "live_fetch": self.live_fetch,
            "browser_impersonation": self.browser_impersonation,
            "max_requests_per_minute": self.max_requests_per_minute,
            "concurrency_per_host": self.concurrency_per_host,
            "media_reuse_policy": self.media_reuse_policy,
            "terms_url": self.terms_url,
            "robots_url": self.robots_url,
            "policy_urls": list(self.policy_urls),
            "reviewed_at": self.reviewed_at.isoformat(),
            "review_expires_at": self.review_expires_at.isoformat(),
            "notes": list(self.notes),
        }


@dataclass(frozen=True, slots=True)
class SourceRegistry:
    schema_version: int
    review_document: str
    review_document_sha256: str
    sources: tuple[ReviewedSource, ...]

    def get(self, source_id: str) -> ReviewedSource:
        matches = [source for source in self.sources if source.source_id == source_id]
        if len(matches) != 1:
            raise KeyError(f"reviewed source {source_id!r} was not found exactly once")
        return matches[0]


def load_source_registry(
    path: Path = _DEFAULT_REGISTRY_PATH,
    *,
    today: date | None = None,
) -> SourceRegistry:
    raw = json.loads(path.read_text(encoding="utf-8"))
    registry = _parse_registry(raw)
    validate_source_registry(registry, today=today or date.today())
    return registry


def validate_source_registry(registry: SourceRegistry, *, today: date) -> None:
    if registry.schema_version != 1:
        raise ValueError("source registry schema_version must be 1")
    if not _is_sha256(registry.review_document_sha256):
        raise ValueError("source registry review document SHA-256 is invalid")

    review_path = _REPOSITORY_ROOT / registry.review_document
    if not review_path.is_file():
        raise ValueError("source registry review document is missing")
    review_bytes = _normalized_text_bytes(review_path)
    actual_hash = sha256(review_bytes).hexdigest()
    if actual_hash != registry.review_document_sha256:
        raise ValueError("source registry review document SHA-256 drifted")

    source_ids = [source.source_id for source in registry.sources]
    if len(source_ids) != len(set(source_ids)):
        raise ValueError("source registry contains duplicate source_id values")
    if not source_ids:
        raise ValueError("source registry must contain at least one source")

    for source in registry.sources:
        _validate_source(source, today=today)

    _validate_wikimedia_source(registry.get("wikimedia-commons-action-api"))
    _validate_non_live_source(
        registry.get("zoo-atlanta-public-pages"),
        expected_status=AccessStatus.PERMISSION_REQUIRED,
    )
    _validate_non_live_source(
        registry.get("fu-bao-current-location-official-source"),
        expected_status=AccessStatus.MANUAL_REVIEW_REQUIRED,
    )


def _validate_source(source: ReviewedSource, *, today: date) -> None:
    if not source.source_id or not source.label:
        raise ValueError("reviewed sources require source_id and label")
    if source.reviewed_at > source.review_expires_at:
        raise ValueError(f"source {source.source_id} review dates are invalid")
    if today > source.review_expires_at:
        raise ValueError(f"source {source.source_id} review expired")

    for url in [source.base_url, source.terms_url, source.robots_url, *source.policy_urls]:
        if url is not None:
            _require_https_url(url, source.source_id)

    if source.access_status is AccessStatus.APPROVED:
        if not source.live_fetch:
            raise ValueError(f"approved source {source.source_id} must enable live_fetch")
        if not source.allowed_hosts or not source.allowed_paths:
            raise ValueError(f"approved source {source.source_id} needs host and path allowlists")
        if not 1 <= source.max_requests_per_minute <= 60:
            raise ValueError(f"approved source {source.source_id} has an invalid request rate")
        if source.concurrency_per_host != 1:
            raise ValueError(f"approved source {source.source_id} must use one request per host")
        if source.terms_url is None or source.robots_url is None:
            raise ValueError(f"approved source {source.source_id} lacks terms or robots evidence")
    else:
        _validate_non_live_source(source, expected_status=source.access_status)


def _validate_wikimedia_source(source: ReviewedSource) -> None:
    source.assert_live_fetch_allowed()
    if source.base_url != "https://commons.wikimedia.org/w/api.php":
        raise ValueError("Wikimedia source endpoint drifted")
    if source.allowed_hosts != ("commons.wikimedia.org",):
        raise ValueError("Wikimedia source host allowlist drifted")
    if source.allowed_paths != ("/w/api.php",):
        raise ValueError("Wikimedia source path allowlist drifted")
    if source.capability != "public-http":
        raise ValueError("Wikimedia source must use public-http")
    if source.browser_impersonation:
        raise ValueError("Wikimedia automated API traffic must not impersonate a browser")
    if source.media_reuse_policy != "per-file-license-required":
        raise ValueError("Wikimedia source must require per-file license review")
    if not any("User-Agent_Policy" in url for url in source.policy_urls):
        raise ValueError("Wikimedia source lacks User-Agent policy evidence")


def _validate_non_live_source(
    source: ReviewedSource,
    *,
    expected_status: AccessStatus,
) -> None:
    if source.access_status is not expected_status:
        raise ValueError(f"source {source.source_id} access status drifted")
    if source.live_fetch:
        raise ValueError(f"source {source.source_id} must not enable live fetch")
    if source.max_requests_per_minute != 0 or source.concurrency_per_host != 0:
        raise ValueError(f"source {source.source_id} must have zero automated request capacity")
    if source.allowed_paths:
        raise ValueError(f"source {source.source_id} must not expose automated paths")


def _parse_registry(raw: dict[str, Any]) -> SourceRegistry:
    try:
        sources = tuple(_parse_source(item) for item in raw["sources"])
        return SourceRegistry(
            schema_version=int(raw["schema_version"]),
            review_document=str(raw["review_document"]),
            review_document_sha256=str(raw["review_document_sha256"]),
            sources=sources,
        )
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"invalid source registry: {error}") from error


def _parse_source(raw: dict[str, Any]) -> ReviewedSource:
    return ReviewedSource(
        source_id=str(raw["source_id"]),
        label=str(raw["label"]),
        access_status=AccessStatus(str(raw["access_status"])),
        base_url=str(raw["base_url"]) if raw.get("base_url") is not None else None,
        allowed_hosts=tuple(str(value) for value in raw["allowed_hosts"]),
        allowed_paths=tuple(str(value) for value in raw["allowed_paths"]),
        capability=str(raw["capability"]),
        live_fetch=bool(raw["live_fetch"]),
        browser_impersonation=bool(raw["browser_impersonation"]),
        max_requests_per_minute=int(raw["max_requests_per_minute"]),
        concurrency_per_host=int(raw["concurrency_per_host"]),
        media_reuse_policy=str(raw["media_reuse_policy"]),
        terms_url=str(raw["terms_url"]) if raw.get("terms_url") is not None else None,
        robots_url=str(raw["robots_url"]) if raw.get("robots_url") is not None else None,
        policy_urls=tuple(str(value) for value in raw["policy_urls"]),
        reviewed_at=date.fromisoformat(str(raw["reviewed_at"])),
        review_expires_at=date.fromisoformat(str(raw["review_expires_at"])),
        notes=tuple(str(value) for value in raw["notes"]),
    )


def _require_https_url(url: str, source_id: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(f"source {source_id} contains a non-HTTPS review URL")


def _normalized_text_bytes(path: Path) -> bytes:
    text = path.read_text(encoding="utf-8")
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in _HEX for character in value)
