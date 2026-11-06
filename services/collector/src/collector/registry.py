"""Account registry for AIHOT, generated from targets.yaml.

AIHOT looks up a post's original author here to decide its source tier, and ZhiPanda uses the same
file to tell which institution an account speaks for. One AIHOT source exists per target.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from collector.adapters.mediacrawler import PLATFORMS
from collector.aihot import source_id, source_name
from collector.models import Role, Target, TargetKind

SOURCE_TIER: dict[Role | None, str] = {
    Role.INSTITUTION: "T1",
    Role.OFFICIAL: "T1_5",
    Role.MEDIA: "T2",
    Role.FAN: "T2",
    None: "T2",
}


def target_platform(target: Target) -> str:
    """The platform name items of this target carry in `items.platform`."""
    params = target.params
    if target.adapter == "weibo_crawler":
        return "weibo"
    if target.adapter == "xhs_mcp":
        return "xiaohongshu"
    if target.adapter == "douyin_api":
        return str(params.get("platform", "douyin"))
    if target.adapter == "mediacrawler":
        return PLATFORMS[params["platform"]][0]
    return str(params.get("platform", "web"))


def build(targets: list[Target]) -> dict[str, Any]:
    accounts = []
    for t in targets:
        if t.kind is not TargetKind.ACCOUNT or t.role is None:
            continue
        account: dict[str, Any] = {
            "platform": target_platform(t),
            "accountId": t.value,
            "role": t.role.value,
            "label": t.label,
        }
        if t.institution:
            account["institution"] = t.institution
        accounts.append(account)
    sources = [
        {
            "id": source_id(t.id),
            "name": source_name(t.label, t.tier.value),
            "tier": SOURCE_TIER[t.role if t.kind is TargetKind.ACCOUNT else None],
            "participation_mode": "editorial",
        }
        for t in targets
    ]
    accounts.sort(key=lambda a: (a["platform"], a["accountId"]))
    sources.sort(key=lambda s: s["id"])
    return {"accounts": accounts, "sources": sources}


def write(targets: list[Target], out: Path) -> None:
    out.write_text(
        json.dumps(build(targets), ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def _literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sources_sql(targets: list[Target]) -> str:
    """Upserts every collector target as an `editorial` source in AIHOT's `sources` table.

    AIHOT creates an unknown pushed source as `T2` and `isolated`, which keeps it out of selection;
    running this before (or after) the first push gives each source its tier and lets it in.
    """
    rows = [
        f"({_literal(s['id'])}, {_literal(s['name'])}, 'external', '{{}}'::jsonb, "
        f"{_literal(s['tier'])}, 'editorial', 1440, true, 'ok', ARRAY['zhipanda:collector'])"
        for s in build(targets)["sources"]
    ]
    return (
        "INSERT INTO sources (id, name, kind, config, tier, participation_mode, interval_minutes,"
        " enabled, health, tags)\nVALUES\n  "
        + ",\n  ".join(rows)
        + "\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tier = EXCLUDED.tier,"
        " participation_mode = EXCLUDED.participation_mode;\n"
    )
