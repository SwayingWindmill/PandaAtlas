"""Host settings (environment) and the target list (data/collector/targets.yaml)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import yaml

from collector.adapters.base import Adapter
from collector.adapters.douyin_api import DouyinApiAdapter
from collector.adapters.mediacrawler import MediaCrawlerAdapter
from collector.adapters.rss import RssAdapter
from collector.adapters.weibo_crawler import WeiboCrawlerAdapter
from collector.adapters.xhs_mcp import XhsMcpAdapter
from collector.models import DEFAULT_INTERVAL_MINUTES, Role, Target, TargetKind, Tier

REPO_ROOT = Path(__file__).resolve().parents[4]


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or default


def _path(name: str, default: Path) -> Path:
    value = _env(name)
    return Path(value) if value else default


@dataclass(frozen=True)
class Settings:
    database_url: str
    targets_file: Path
    pandas_csv: Path
    aliases_file: Path
    state_dir: Path
    rsshub_url: str | None
    xhs_mcp_url: str | None
    xhs_mcp_token: str | None
    douyin_api_url: str | None
    douyin_api_key: str | None
    weibo_crawler_dir: Path | None
    weibo_crawler_cmd: str
    weibo_cookie: str | None
    mediacrawler_dir: Path | None
    mediacrawler_cmd: str
    aihot_url: str | None
    aihot_token: str | None
    alert_webhook: str | None
    alert_format: str
    rss_concurrency: int

    @classmethod
    def from_env(cls) -> Settings:
        weibo_dir, media_dir = _env("WEIBO_CRAWLER_DIR"), _env("MEDIACRAWLER_DIR")
        return cls(
            database_url=_env("COLLECTOR_DATABASE_URL")
            or "postgresql://collector:collector@localhost:55432/collector",
            targets_file=_path("COLLECTOR_TARGETS", REPO_ROOT / "data/collector/targets.yaml"),
            pandas_csv=_path("COLLECTOR_PANDAS_CSV", REPO_ROOT / "data/curation/pandas/pandas.csv"),
            aliases_file=_path("COLLECTOR_ALIASES", REPO_ROOT / "data/collector/aliases.yaml"),
            state_dir=_path("COLLECTOR_STATE_DIR", REPO_ROOT / ".collector"),
            rsshub_url=_env("RSSHUB_URL"),
            xhs_mcp_url=_env("XHS_MCP_URL"),
            xhs_mcp_token=_env("XHS_MCP_TOKEN"),
            douyin_api_url=_env("DOUYIN_API_URL"),
            douyin_api_key=_env("DOUYIN_API_KEY"),
            weibo_crawler_dir=Path(weibo_dir) if weibo_dir else None,
            weibo_crawler_cmd=_env("WEIBO_CRAWLER_CMD", "python weibo.py") or "",
            weibo_cookie=_env("WEIBO_COOKIE"),
            mediacrawler_dir=Path(media_dir) if media_dir else None,
            mediacrawler_cmd=_env("MEDIACRAWLER_CMD", "uv run main.py") or "",
            aihot_url=_env("AIHOT_URL"),
            aihot_token=_env("AIHOT_INGEST_TOKEN"),
            alert_webhook=_env("COLLECTOR_ALERT_WEBHOOK"),
            alert_format=_env("COLLECTOR_ALERT_FORMAT", "feishu") or "feishu",
            rss_concurrency=int(_env("COLLECTOR_RSS_CONCURRENCY", "4") or 4),
        )


def build_adapters(settings: Settings, client: httpx.AsyncClient) -> dict[str, Adapter]:
    """Only collectors this host is set up for; targets of the others wait and are not failed."""
    adapters: dict[str, Adapter] = {"rss": RssAdapter(client, settings.rsshub_url)}
    if settings.xhs_mcp_url:
        adapters["xhs_mcp"] = XhsMcpAdapter(client, settings.xhs_mcp_url, settings.xhs_mcp_token)
    if settings.douyin_api_url:
        adapters["douyin_api"] = DouyinApiAdapter(
            client, settings.douyin_api_url, settings.douyin_api_key
        )
    if settings.weibo_crawler_dir:
        adapters["weibo_crawler"] = WeiboCrawlerAdapter(
            settings.weibo_crawler_dir,
            settings.weibo_crawler_cmd,
            settings.weibo_cookie,
            settings.state_dir,
        )
    if settings.mediacrawler_dir:
        adapters["mediacrawler"] = MediaCrawlerAdapter(
            settings.mediacrawler_dir, settings.mediacrawler_cmd
        )
    return adapters


ADAPTER_NAMES = {"rss", "xhs_mcp", "douyin_api", "weibo_crawler", "mediacrawler"}


class ConfigError(ValueError):
    pass


def _target(entry: dict[str, Any], defaults: dict[str, Any]) -> Target:
    merged = {**defaults, **entry}
    try:
        adapter, kind, value = merged["adapter"], TargetKind(merged["kind"]), str(merged["value"])
        tier = Tier(merged.get("tier", "key_account"))
        role = Role(merged["role"]) if merged.get("role") else None
    except (KeyError, ValueError) as exc:
        raise ConfigError(f"bad target {entry!r}: {exc}") from exc
    if adapter not in ADAPTER_NAMES:
        raise ConfigError(f"unknown adapter {adapter!r} in {entry!r}")
    institution = str(merged["institution"]).strip() if merged.get("institution") else None
    if role is Role.INSTITUTION and not institution:
        raise ConfigError(f"role institution needs an institution slug: {entry!r}")
    params = {**defaults.get("params", {}), **entry.get("params", {})}
    # Multi-platform adapters search the same term once per platform.
    scope = (
        f"@{params['platform']}"
        if adapter in ("mediacrawler", "douyin_api") and params.get("platform")
        else ""
    )
    return Target(
        id=merged.get("id") or f"{adapter}{scope}:{kind}:{value}",
        adapter=adapter,
        kind=kind,
        value=value,
        label=merged.get("label") or value,
        tier=tier,
        interval_minutes=int(merged.get("interval_minutes") or DEFAULT_INTERVAL_MINUTES[tier]),
        params=params,
        role=role,
        institution=institution,
    )


def load_targets(path: Path) -> list[Target]:
    """`targets` lists explicit targets; each `keyword_groups` entry fans its terms out to every
    adapter it names, so one keyword is searched on every platform."""
    doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    targets = [_target(e, {}) for e in doc.get("targets") or []]
    for group in doc.get("keyword_groups") or []:
        defaults = {k: v for k, v in group.items() if k not in ("adapters", "terms")}
        defaults.setdefault("tier", "keyword")
        for adapter in group.get("adapters") or []:
            adapter_name = adapter if isinstance(adapter, str) else adapter["adapter"]
            adapter_params = {} if isinstance(adapter, str) else adapter.get("params", {})
            for term in group.get("terms") or []:
                targets.append(
                    _target(
                        {
                            "adapter": adapter_name,
                            "kind": "keyword",
                            "value": term,
                            "label": f"关键词：{term}",
                            "params": adapter_params,
                        },
                        defaults,
                    )
                )
    ids = [t.id for t in targets]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ConfigError(f"duplicate target ids: {duplicates}")
    return targets
