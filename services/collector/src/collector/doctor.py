"""Preflight health checks for the collector host, database, and configured upstreams."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

import httpx
import psycopg
import yaml

from collector.config import Settings, load_targets
from collector.lexicon import Lexicon

CheckStatus = Literal["ok", "warn", "fail"]

VALID_ALERT_FORMATS = {"feishu", "wecom", "slack"}
ALWAYS_ENABLED_ADAPTERS = {"rss", "bjzoo", "douban_group", "weibo_rsshub"}
PROBE_TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class CheckResult:
    name: str
    status: CheckStatus
    detail: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "status": self.status, "detail": self.detail}


def configured_adapters(settings: Settings) -> set[str]:
    adapters = set(ALWAYS_ENABLED_ADAPTERS)
    if settings.xhs_mcp_url:
        adapters.add("xhs_mcp")
    if settings.douyin_api_url:
        adapters.add("douyin_api")
    if settings.weibo_crawler_dir:
        adapters.add("weibo_crawler")
    return adapters


def _check_alerts(settings: Settings) -> CheckResult:
    if settings.alert_format not in VALID_ALERT_FORMATS:
        return CheckResult(
            "alerts",
            "fail",
            f"unsupported COLLECTOR_ALERT_FORMAT={settings.alert_format!r} "
            f"(expected feishu, wecom, or slack)",
        )
    if not settings.alert_webhook:
        return CheckResult(
            "alerts",
            "warn",
            "COLLECTOR_ALERT_WEBHOOK unset; alerts will stay in DB and logs only",
        )
    parsed = urlparse(settings.alert_webhook)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return CheckResult(
            "alerts",
            "fail",
            f"invalid COLLECTOR_ALERT_WEBHOOK URL: {settings.alert_webhook!r}",
        )
    return CheckResult("alerts", "ok", f"{settings.alert_format} webhook URL valid")


def _check_config(settings: Settings, has_weibo_rsshub: bool) -> CheckResult:
    failures: list[str] = []
    warnings: list[str] = []

    if settings.rss_concurrency < 1:
        failures.append(f"COLLECTOR_RSS_CONCURRENCY must be >= 1 (got {settings.rss_concurrency})")
    if bool(settings.xhs_mcp_url) != bool(settings.xhs_mcp_token):
        failures.append("XHS_MCP_URL and XHS_MCP_TOKEN must both be set")
    if bool(settings.zhipanda_api_url) != bool(settings.zhipanda_news_ingest_token):
        failures.append("ZHIPANDA_API_URL and ZHIPANDA_NEWS_INGEST_TOKEN must both be set")
    llm_values = (settings.llm_base_url, settings.llm_api_key, settings.llm_model)
    if any(llm_values) and not all(llm_values):
        failures.append("LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL must all be set together")
    if settings.zhipanda_api_url and not settings.llm_model:
        failures.append("ZHIPANDA_API_URL requires LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL")
    if settings.llm_extra_json:
        try:
            parsed = json.loads(settings.llm_extra_json)
        except json.JSONDecodeError:
            failures.append("LLM_EXTRA_JSON must be valid JSON")
        else:
            if not isinstance(parsed, dict):
                failures.append("LLM_EXTRA_JSON must be a JSON object")
    if bool(settings.aihot_url) != bool(settings.aihot_token):
        failures.append("AIHOT_URL and AIHOT_INGEST_TOKEN must both be set")

    if settings.douyin_api_url and not settings.douyin_api_key:
        warnings.append("DOUYIN_API_KEY unset; Douyin API requests may be rejected")
    if has_weibo_rsshub and not settings.rsshub_url:
        warnings.append("RSSHUB_URL unset; weibo_rsshub targets will fail until configured")

    if failures:
        return CheckResult("config", "fail", "; ".join(failures + warnings))
    if warnings:
        return CheckResult("config", "warn", "; ".join(warnings))
    return CheckResult("config", "ok", "settings consistent")


async def _check_database(database_url: str) -> CheckResult:
    try:
        conn = await psycopg.AsyncConnection.connect(database_url, connect_timeout=5)
        try:
            cur = await conn.execute("SELECT to_regclass('public.targets')")
            row = await cur.fetchone()
            if row and row[0]:
                return CheckResult("database", "ok", "PostgreSQL reachable and schema present")
            return CheckResult(
                "database",
                "warn",
                "connected to PostgreSQL, but schema is not migrated yet (run collector migrate)",
            )
        finally:
            await conn.close()
    except (psycopg.Error, OSError) as exc:
        return CheckResult("database", "fail", f"PostgreSQL check failed: {exc}")


async def _probe_http(
    name: str,
    base_url: str,
    client: httpx.AsyncClient,
    *,
    is_rsshub: bool = False,
) -> CheckResult:
    root = base_url.rstrip("/")
    try:
        if is_rsshub:
            response = await client.get(f"{root}/healthz", timeout=PROBE_TIMEOUT_SECONDS)
            if response.status_code == 404:
                response = await client.get(f"{root}/", timeout=PROBE_TIMEOUT_SECONDS)
            if response.status_code < 400:
                return CheckResult(name, "ok", f"HTTP {response.status_code} ({root})")
            if response.status_code < 500:
                return CheckResult(name, "warn", f"HTTP {response.status_code} ({root})")
            return CheckResult(name, "fail", f"HTTP {response.status_code} ({root})")

        response = await client.get(f"{root}/", timeout=PROBE_TIMEOUT_SECONDS)
        if response.status_code < 500:
            return CheckResult(name, "ok", f"HTTP {response.status_code} ({root})")
        return CheckResult(name, "fail", f"HTTP {response.status_code} ({root})")
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        return CheckResult(name, "fail", f"request to {root} failed: {exc}")


async def run_doctor(
    settings: Settings,
    *,
    offline: bool = False,
    client: httpx.AsyncClient | None = None,
) -> list[CheckResult]:
    results: list[CheckResult] = []
    has_weibo_rsshub = False

    try:
        targets = load_targets(settings.targets_file)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        results.append(CheckResult("targets", "fail", f"failed to load targets: {exc}"))
    else:
        adapters = configured_adapters(settings)
        counts = Counter(target.adapter for target in targets)
        has_weibo_rsshub = counts.get("weibo_rsshub", 0) > 0
        active_count = sum(1 for target in targets if target.adapter in adapters)
        waiting_count = len(targets) - active_count
        breakdown = ", ".join(f"{name}={counts[name]}" for name in sorted(counts))
        results.append(
            CheckResult(
                "targets",
                "ok",
                f"{len(targets)} total ({active_count} active on host, "
                f"{waiting_count} waiting): {breakdown}",
            )
        )

    try:
        lexicon = Lexicon.load(settings.pandas_source, settings.aliases_file)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        results.append(CheckResult("lexicon", "fail", f"failed to load lexicon: {exc}"))
    else:
        unique_slugs = {slug for slugs in lexicon.names.values() for slug in slugs}
        results.append(
            CheckResult(
                "lexicon",
                "ok",
                f"{len(lexicon.names)} name patterns covering {len(unique_slugs)} pandas",
            )
        )

    results.append(_check_alerts(settings))
    results.append(_check_config(settings, has_weibo_rsshub=has_weibo_rsshub))

    if offline:
        return results

    results.append(await _check_database(settings.database_url))

    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=PROBE_TIMEOUT_SECONDS)
    try:
        if settings.rsshub_url:
            results.append(await _probe_http("rsshub", settings.rsshub_url, http, is_rsshub=True))
        for name, url in (
            ("xhs_mcp", settings.xhs_mcp_url),
            ("douyin_api", settings.douyin_api_url),
            ("zhipanda_api", settings.zhipanda_api_url),
            ("aihot", settings.aihot_url),
        ):
            if url:
                results.append(await _probe_http(name, url, http))
    finally:
        if owns_client:
            await http.aclose()

    return results


def has_failures(results: list[CheckResult]) -> bool:
    return any(item.status == "fail" for item in results)


def format_text(results: list[CheckResult]) -> str:
    return "\n".join(f"[{item.status.upper():4}] {item.name}: {item.detail}" for item in results)
