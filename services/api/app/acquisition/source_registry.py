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
_REPOSITORY_CONTACT = "https://github.com/SwayingWindmill/PandaAtlas"
_BROWSER_USER_AGENT_MARKERS = ("Mozilla/", "Chrome/", "Safari/", "Firefox/")


class AccessStatus(StrEnum):
    APPROVED = "approved"
    PERMISSION_REQUIRED = "permission-required"
    MANUAL_REVIEW_REQUIRED = "manual-review-required"


class AuthenticationMode(StrEnum):
    NONE = "none"
    REVIEWED_SESSION = "reviewed-session"


class RedirectPolicy(StrEnum):
    DENY = "deny"
    SAME_HOST = "same-host"


@dataclass(frozen=True, slots=True)
class RequestPolicy:
    user_agent: str
    accept: str
    allowed_methods: tuple[str, ...]
    allow_query_string: bool
    authentication: AuthenticationMode
    send_cookies: bool
    timeout_seconds: float
    redirect_policy: RedirectPolicy
    max_redirects: int
    max_attempts: int
    retry_server_errors: bool
    retry_backoff_seconds: float
    honor_retry_after: bool
    stop_statuses: tuple[int, ...]
    stop_on_challenge: bool

    def __post_init__(self) -> None:
        _validate_bot_user_agent(self.user_agent)
        if not self.accept.strip():
            raise ValueError("request policy requires an Accept value")
        normalized_methods = tuple(method.strip().upper() for method in self.allowed_methods)
        if normalized_methods != ("GET",):
            raise ValueError("reviewed source request policies currently allow GET only")
        object.__setattr__(self, "allowed_methods", normalized_methods)
        if self.authentication is AuthenticationMode.NONE and self.send_cookies:
            raise ValueError("unauthenticated reviewed requests cannot send cookies")
        if self.timeout_seconds <= 0 or self.timeout_seconds > 120:
            raise ValueError("request policy timeout must be between 0 and 120 seconds")
        if self.max_redirects < 0 or self.max_redirects > 5:
            raise ValueError("request policy max_redirects must be between 0 and 5")
        if self.redirect_policy is RedirectPolicy.DENY and self.max_redirects != 0:
            raise ValueError("deny redirect policy requires max_redirects=0")
        if self.redirect_policy is RedirectPolicy.SAME_HOST and self.max_redirects < 1:
            raise ValueError("same-host redirect policy requires at least one redirect")
        if self.max_attempts < 1 or self.max_attempts > 3:
            raise ValueError("request policy max_attempts must be between 1 and 3")
        if self.max_attempts > 1 and not self.retry_server_errors:
            raise ValueError("multiple attempts require retry_server_errors")
        if self.retry_backoff_seconds < 0 or self.retry_backoff_seconds > 300:
            raise ValueError("request policy retry backoff is outside the reviewed range")
        normalized_statuses = tuple(sorted(set(self.stop_statuses)))
        if any(status < 400 or status > 599 for status in normalized_statuses):
            raise ValueError("request policy stop statuses must be HTTP error statuses")
        object.__setattr__(self, "stop_statuses", normalized_statuses)

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "user_agent": self.user_agent,
            "accept": self.accept,
            "allowed_methods": list(self.allowed_methods),
            "allow_query_string": self.allow_query_string,
            "authentication": self.authentication.value,
            "send_cookies": self.send_cookies,
            "timeout_seconds": self.timeout_seconds,
            "redirect_policy": self.redirect_policy.value,
            "max_redirects": self.max_redirects,
            "max_attempts": self.max_attempts,
            "retry_server_errors": self.retry_server_errors,
            "retry_backoff_seconds": self.retry_backoff_seconds,
            "honor_retry_after": self.honor_retry_after,
            "stop_statuses": list(self.stop_statuses),
            "stop_on_challenge": self.stop_on_challenge,
        }


@dataclass(frozen=True, slots=True)
class ReviewedSource:
    source_id: str
    label: str
    access_status: AccessStatus
    base_url: str | None
    allowed_hosts: tuple[str, ...]
    allowed_paths: tuple[str, ...]
    allowed_adapter_ids: tuple[str, ...]
    capability: str
    live_fetch: bool
    browser_impersonation: bool
    max_requests_per_minute: int
    concurrency_per_host: int
    request_policy: RequestPolicy | None
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
        if self.request_policy is None:
            raise ValueError(f"source {self.source_id} has no reviewed request policy")

    def assert_adapter_allowed(self, adapter_id: str) -> None:
        if adapter_id not in self.allowed_adapter_ids:
            raise ValueError(
                f"adapter {adapter_id!r} is not allowlisted for reviewed source {self.source_id}"
            )

    def validate_request_target(self, url: str, *, live: bool) -> None:
        if live:
            self.assert_live_fetch_allowed()
        parsed = urlparse(url)
        try:
            port = parsed.port
        except ValueError as error:
            raise ValueError("request target contains an invalid port") from error
        if (
            parsed.scheme != "https"
            or parsed.hostname not in self.allowed_hosts
            or parsed.username is not None
            or parsed.password is not None
            or port not in {None, 443}
            or bool(parsed.fragment)
        ):
            raise ValueError(f"request target is outside source {self.source_id} host allowlist")
        if parsed.path not in self.allowed_paths:
            raise ValueError(f"request target is outside source {self.source_id} path allowlist")
        if parsed.query and (
            self.request_policy is None or not self.request_policy.allow_query_string
        ):
            raise ValueError(f"request target query is not approved for source {self.source_id}")

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "label": self.label,
            "access_status": self.access_status.value,
            "base_url": self.base_url,
            "allowed_hosts": list(self.allowed_hosts),
            "allowed_paths": list(self.allowed_paths),
            "allowed_adapter_ids": list(self.allowed_adapter_ids),
            "capability": self.capability,
            "live_fetch": self.live_fetch,
            "browser_impersonation": self.browser_impersonation,
            "max_requests_per_minute": self.max_requests_per_minute,
            "concurrency_per_host": self.concurrency_per_host,
            "request_policy": (
                self.request_policy.to_public_dict() if self.request_policy is not None else None
            ),
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

    adapter_ids = [
        adapter_id for source in registry.sources for adapter_id in source.allowed_adapter_ids
    ]
    if len(adapter_ids) != len(set(adapter_ids)):
        raise ValueError("an adapter ID cannot be allowlisted by multiple reviewed sources")

    for source in registry.sources:
        _validate_source(source, today=today)

    _validate_wikimedia_source(registry.get("wikimedia-commons-action-api"))
    _validate_smithsonian_source(registry.get("smithsonian-national-zoo-panda-pages"))
    _validate_non_live_source(
        registry.get("zoo-atlanta-public-pages"),
        expected_status=AccessStatus.PERMISSION_REQUIRED,
    )
    _validate_non_live_source(
        registry.get("tokyo-zoo-net-panda-pages"),
        expected_status=AccessStatus.MANUAL_REVIEW_REQUIRED,
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
        if not source.allowed_hosts or not source.allowed_paths:
            raise ValueError(f"approved source {source.source_id} needs host and path allowlists")
        if not source.allowed_adapter_ids:
            raise ValueError(f"approved source {source.source_id} needs an adapter allowlist")
        if source.terms_url is None or source.robots_url is None:
            raise ValueError(f"approved source {source.source_id} lacks terms or robots evidence")
        if source.request_policy is None:
            raise ValueError(f"approved source {source.source_id} lacks a request policy")
        if source.browser_impersonation:
            raise ValueError(f"approved source {source.source_id} must not impersonate a browser")
        if source.live_fetch:
            if not 1 <= source.max_requests_per_minute <= 60:
                raise ValueError(f"approved source {source.source_id} has an invalid request rate")
            if source.concurrency_per_host != 1:
                raise ValueError(
                    f"approved source {source.source_id} must use one request per host"
                )
        elif source.max_requests_per_minute != 0 or source.concurrency_per_host != 0:
            raise ValueError(
                f"disabled approved source {source.source_id} must have zero request capacity"
            )
    else:
        _validate_non_live_source(source, expected_status=source.access_status)


def _validate_wikimedia_source(source: ReviewedSource) -> None:
    if source.access_status is not AccessStatus.APPROVED:
        raise ValueError("Wikimedia source approval drifted")
    if source.base_url != "https://commons.wikimedia.org/w/api.php":
        raise ValueError("Wikimedia source endpoint drifted")
    if source.allowed_hosts != ("commons.wikimedia.org",):
        raise ValueError("Wikimedia source host allowlist drifted")
    if source.allowed_paths != ("/w/api.php",):
        raise ValueError("Wikimedia source path allowlist drifted")
    if source.allowed_adapter_ids != ("wikimedia-commons-xi-lun",):
        raise ValueError("Wikimedia adapter allowlist drifted")
    if source.capability != "public-http":
        raise ValueError("Wikimedia source must use public-http")
    expected_rate = 6 if source.live_fetch else 0
    expected_concurrency = 1 if source.live_fetch else 0
    if (
        source.max_requests_per_minute != expected_rate
        or source.concurrency_per_host != expected_concurrency
    ):
        raise ValueError("Wikimedia automated capacity drifted")
    if source.browser_impersonation:
        raise ValueError("Wikimedia automated API traffic must not impersonate a browser")
    if source.media_reuse_policy != "per-file-license-required":
        raise ValueError("Wikimedia source must require per-file license review")
    if not any("User-Agent_Policy" in url for url in source.policy_urls):
        raise ValueError("Wikimedia source lacks User-Agent policy evidence")
    policy = source.request_policy
    assert policy is not None
    if policy.accept != "application/json":
        raise ValueError("Wikimedia request Accept value drifted")
    if not policy.allow_query_string:
        raise ValueError("Wikimedia query-string policy drifted")
    if policy.redirect_policy is not RedirectPolicy.DENY:
        raise ValueError("Wikimedia redirect policy drifted")
    if policy.max_attempts != 1 or policy.retry_server_errors:
        raise ValueError("Wikimedia retry policy drifted")


def _validate_smithsonian_source(source: ReviewedSource) -> None:
    if source.access_status is not AccessStatus.APPROVED:
        raise ValueError("Smithsonian source approval drifted")
    if source.base_url != "https://nationalzoo.si.edu/":
        raise ValueError("Smithsonian source base URL drifted")
    if source.allowed_hosts != ("nationalzoo.si.edu",):
        raise ValueError("Smithsonian source host allowlist drifted")
    expected_paths = (
        "/animals/giant-panda",
        "/animals/giant-panda-faqs",
        "/animals/history-giant-pandas-zoo",
    )
    if source.allowed_paths != expected_paths:
        raise ValueError("Smithsonian source path allowlist drifted")
    if source.allowed_adapter_ids != ("smithsonian-panda-profiles",):
        raise ValueError("Smithsonian adapter allowlist drifted")
    if source.capability != "public-http":
        raise ValueError("Smithsonian source must use public-http")
    if source.browser_impersonation:
        raise ValueError("Smithsonian requests must not impersonate a browser")
    expected_rate = 2 if source.live_fetch else 0
    expected_concurrency = 1 if source.live_fetch else 0
    if (
        source.max_requests_per_minute != expected_rate
        or source.concurrency_per_host != expected_concurrency
    ):
        raise ValueError("Smithsonian automated capacity drifted")
    if source.media_reuse_policy != "facts-only-no-media-reuse":
        raise ValueError("Smithsonian source must prohibit media reuse")
    if source.terms_url != "https://www.si.edu/termsofuse":
        raise ValueError("Smithsonian source terms URL drifted")
    if source.robots_url != "https://nationalzoo.si.edu/robots.txt":
        raise ValueError("Smithsonian source robots URL drifted")
    policy = source.request_policy
    assert policy is not None
    if policy.accept != "text/html":
        raise ValueError("Smithsonian request Accept value drifted")
    if policy.allow_query_string:
        raise ValueError("Smithsonian query-string policy drifted")
    if policy.redirect_policy is not RedirectPolicy.SAME_HOST or policy.max_redirects != 1:
        raise ValueError("Smithsonian redirect policy drifted")
    if policy.max_attempts != 2 or not policy.retry_server_errors:
        raise ValueError("Smithsonian retry policy drifted")
    if policy.retry_backoff_seconds != 60:
        raise ValueError("Smithsonian retry backoff drifted")


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
    if source.allowed_adapter_ids:
        raise ValueError(f"source {source.source_id} must not expose acquisition adapters")
    if source.request_policy is not None:
        raise ValueError(f"source {source.source_id} must not expose a live request policy")


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
    request_policy_raw = raw.get("request_policy")
    return ReviewedSource(
        source_id=str(raw["source_id"]),
        label=str(raw["label"]),
        access_status=AccessStatus(str(raw["access_status"])),
        base_url=str(raw["base_url"]) if raw.get("base_url") is not None else None,
        allowed_hosts=tuple(str(value) for value in raw["allowed_hosts"]),
        allowed_paths=tuple(str(value) for value in raw["allowed_paths"]),
        allowed_adapter_ids=tuple(str(value) for value in raw.get("allowed_adapter_ids", ())),
        capability=str(raw["capability"]),
        live_fetch=_required_bool(raw, "live_fetch"),
        browser_impersonation=_required_bool(raw, "browser_impersonation"),
        max_requests_per_minute=int(raw["max_requests_per_minute"]),
        concurrency_per_host=int(raw["concurrency_per_host"]),
        request_policy=(
            _parse_request_policy(request_policy_raw)
            if isinstance(request_policy_raw, dict)
            else None
        ),
        media_reuse_policy=str(raw["media_reuse_policy"]),
        terms_url=str(raw["terms_url"]) if raw.get("terms_url") is not None else None,
        robots_url=str(raw["robots_url"]) if raw.get("robots_url") is not None else None,
        policy_urls=tuple(str(value) for value in raw["policy_urls"]),
        reviewed_at=date.fromisoformat(str(raw["reviewed_at"])),
        review_expires_at=date.fromisoformat(str(raw["review_expires_at"])),
        notes=tuple(str(value) for value in raw["notes"]),
    )


def _parse_request_policy(raw: dict[str, Any]) -> RequestPolicy:
    return RequestPolicy(
        user_agent=str(raw["user_agent"]),
        accept=str(raw["accept"]),
        allowed_methods=tuple(str(value) for value in raw["allowed_methods"]),
        allow_query_string=_required_bool(raw, "allow_query_string"),
        authentication=AuthenticationMode(str(raw["authentication"])),
        send_cookies=_required_bool(raw, "send_cookies"),
        timeout_seconds=float(raw["timeout_seconds"]),
        redirect_policy=RedirectPolicy(str(raw["redirect_policy"])),
        max_redirects=int(raw["max_redirects"]),
        max_attempts=int(raw["max_attempts"]),
        retry_server_errors=_required_bool(raw, "retry_server_errors"),
        retry_backoff_seconds=float(raw["retry_backoff_seconds"]),
        honor_retry_after=_required_bool(raw, "honor_retry_after"),
        stop_statuses=tuple(int(value) for value in raw["stop_statuses"]),
        stop_on_challenge=_required_bool(raw, "stop_on_challenge"),
    )


def _required_bool(raw: dict[str, Any], key: str) -> bool:
    value = raw[key]
    if type(value) is not bool:
        raise ValueError(f"source registry field {key} must be a JSON Boolean")
    return value


def _validate_bot_user_agent(user_agent: str) -> None:
    normalized = " ".join(user_agent.split())
    if not normalized.startswith("PandaAtlasBot/"):
        raise ValueError("reviewed requests require a descriptive PandaAtlasBot User-Agent")
    if _REPOSITORY_CONTACT not in normalized:
        raise ValueError("reviewed request User-Agent requires the repository contact URL")
    if any(marker in normalized for marker in _BROWSER_USER_AGENT_MARKERS):
        raise ValueError("reviewed bot requests must not impersonate a browser User-Agent")


def _require_https_url(url: str, source_id: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError(f"source {source_id} contains a non-HTTPS review URL")


def _normalized_text_bytes(path: Path) -> bytes:
    text = path.read_text(encoding="utf-8")
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in _HEX for character in value)
