from __future__ import annotations

from typing import Any

from .models import CapabilityMode, SourcePolicy
from .policy import validate_source_policy


def scrapy_capability_profile() -> dict[str, Any]:
    return {
        "deterministic_css_xpath": True,
        "persistent_scheduler": True,
        "robots_middleware": True,
        "retry_middleware": True,
        "cookie_sessions": True,
        "stable_proxy": True,
        "browser_rendering": False,
        "tls_browser_impersonation": False,
        "adaptive_selector_suggestions": False,
        "stealth_lab": False,
    }


def scrapling_capability_profile() -> dict[str, Any]:
    return {
        "deterministic_css_xpath": True,
        "persistent_scheduler": True,
        "robots_middleware": True,
        "retry_support": True,
        "cookie_sessions": True,
        "stable_proxy": True,
        "browser_rendering": True,
        "tls_browser_impersonation": True,
        "browser_consistent_headers": True,
        "adaptive_selector_suggestions": True,
        "stealth_lab": True,
        "automatic_proxy_rotation_available_but_disabled": True,
        "challenge_solver_available_but_disabled": True,
    }


def build_fetch_plan(policy: SourcePolicy, engine: str) -> dict[str, Any]:
    validate_source_policy(policy)
    if engine not in {"scrapy", "scrapling"}:
        raise ValueError(f"unsupported engine {engine}")

    common = {
        "source_id": policy.source_id,
        "allowed_hosts": list(policy.allowed_hosts),
        "obey_robots": True,
        "requests_per_minute": policy.requests_per_minute,
        "concurrency_per_host": 1,
        "on_401_403_429_challenge": "stop-and-review",
        "automatic_identity_switch": False,
        "proxy_rotation": False,
        "authorized_session_configured": bool(policy.authorized_session_ref),
        "approved_proxy_configured": bool(policy.approved_proxy_ref),
        "fingerprint_review_configured": bool(policy.fingerprint_review_ref),
    }
    if engine == "scrapy":
        return {
            **common,
            "engine": "scrapy",
            "fetcher": "scrapy-downloader",
            "cookiejar": policy.capability is CapabilityMode.AUTHORIZED_SESSION,
            "settings": {
                "ROBOTSTXT_OBEY": True,
                "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
                "DOWNLOAD_DELAY": round(60 / policy.requests_per_minute, 3),
                "AUTOTHROTTLE_ENABLED": True,
                "RETRY_ENABLED": True,
                "RETRY_TIMES": 2,
                "JOBDIR": "runtime-configured",
            },
        }

    fetcher = "Fetcher"
    options: dict[str, Any] = {
        "stealthy_headers": True,
        "impersonate": "chrome",
        "retries": 2,
        "follow_redirects": "safe",
    }
    if policy.capability is CapabilityMode.BROWSER_RENDERED:
        fetcher = "DynamicFetcher"
        options = {
            "headless": True,
            "real_chrome": True,
            "network_idle": True,
            "google_search": False,
        }
    if policy.capability is CapabilityMode.BROWSER_STEALTH:
        fetcher = "StealthyFetcher"
        options = {
            "headless": True,
            "real_chrome": True,
            "solve_cloudflare": False,
            "hide_canvas": False,
            "block_webrtc": True,
            "google_search": False,
        }
    if policy.capability is CapabilityMode.STEALTH_LAB:
        fetcher = "StealthyFetcher"
        options = {
            "headless": True,
            "real_chrome": True,
            "solve_cloudflare": False,
            "hide_canvas": False,
            "google_search": False,
        }
    return {
        **common,
        "engine": "scrapling",
        "fetcher": fetcher,
        "options": options,
    }
