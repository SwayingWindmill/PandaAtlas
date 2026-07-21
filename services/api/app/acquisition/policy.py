from __future__ import annotations

from ipaddress import ip_address
from urllib.parse import urlparse

from .models import BlockState, CapabilityMode, ResponseEnvelope, SourcePolicy

_CHALLENGE_MARKERS = (
    b"captcha",
    b"turnstile",
    b"cf-chl-",
    b"verify you are human",
    b"challenge-platform",
)
_LOGIN_MARKERS = (
    b"sign in to continue",
    b"login required",
    b"authentication required",
)


def validate_source_policy(policy: SourcePolicy) -> None:
    if not policy.source_id.strip():
        raise ValueError("source_id is required")
    if not policy.allowed_hosts:
        raise ValueError("at least one allowed host is required")
    if not policy.obey_robots:
        raise ValueError("production acquisition must obey robots.txt")
    if policy.requests_per_minute < 1 or policy.requests_per_minute > 60:
        raise ValueError("requests_per_minute must be between 1 and 60")
    if policy.concurrency_per_host != 1:
        raise ValueError("the PoC requires one request at a time per host")
    if policy.proxy_rotation:
        raise ValueError("automatic proxy rotation is not a production capability")
    if policy.challenge_action != "stop-and-review":
        raise ValueError("challenge_action must be stop-and-review")
    if policy.capability is CapabilityMode.AUTHORIZED_SESSION and not policy.authorized_session_ref:
        raise ValueError("authorized sessions require a credential reference")
    if policy.capability is CapabilityMode.APPROVED_PROXY and not policy.approved_proxy_ref:
        raise ValueError("approved proxies require one stable proxy reference")
    if policy.capability is CapabilityMode.STEALTH_LAB:
        for host in policy.allowed_hosts:
            if not _is_loopback_host(host):
                raise ValueError("stealth-lab is restricted to loopback-controlled fixtures")


def validate_target(policy: SourcePolicy, url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("only HTTP(S) targets are supported")
    host = (parsed.hostname or "").lower()
    allowed = {item.lower() for item in policy.allowed_hosts}
    if host not in allowed:
        raise ValueError(f"target host {host!r} is not allowlisted")


def classify_block(response: ResponseEnvelope) -> BlockState:
    body = response.body.lower()
    if response.status == 429:
        return BlockState.RATE_LIMITED
    if any(marker in body for marker in _CHALLENGE_MARKERS):
        return BlockState.HUMAN_CHALLENGE_REQUIRED
    if response.status == 401 or any(marker in body for marker in _LOGIN_MARKERS):
        return BlockState.AUTHORIZATION_REQUIRED
    if response.status in {403, 451}:
        return BlockState.BLOCKED
    return BlockState.CLEAR


def should_extract(block_state: BlockState) -> bool:
    return block_state is BlockState.CLEAR


def _is_loopback_host(host: str) -> bool:
    normalized = host.strip().lower()
    if normalized == "localhost":
        return True
    try:
        return ip_address(normalized).is_loopback
    except ValueError:
        return False
