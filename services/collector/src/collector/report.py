"""Phase-one comparison report: how each collector did over a window, against the plan's targets.

Discovery latency only counts items published after the target's first run; the backlog a new
target imports on its first run would otherwise swamp the numbers.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from collector.store import Store

RUNS = """
SELECT adapter,
       count(*) FILTER (WHERE status <> 'skipped') AS runs,
       count(*) FILTER (WHERE status IN ('ok', 'empty')) AS succeeded,
       count(*) FILTER (WHERE status = 'empty') AS empty,
       count(*) FILTER (WHERE status = 'failed') AS failed,
       coalesce(sum(created), 0) AS created,
       coalesce(sum(revised), 0) AS revised
FROM runs WHERE started_at >= now() - %s
GROUP BY adapter ORDER BY adapter
"""

FAILURES = """
SELECT adapter, error_kind, count(*) AS n FROM runs
WHERE started_at >= now() - %s AND status = 'failed'
GROUP BY adapter, error_kind ORDER BY adapter, n DESC
"""

LATENCY = """
WITH first_run AS (SELECT target_id, min(started_at) AS at FROM runs GROUP BY target_id)
SELECT {group} AS key,
       count(*) AS items,
       percentile_cont(0.5) WITHIN GROUP (
         ORDER BY extract(epoch FROM s.first_seen_at - i.published_at)) / 60 AS p50_minutes,
       percentile_cont(0.95) WITHIN GROUP (
         ORDER BY extract(epoch FROM s.first_seen_at - i.published_at)) / 60 AS p95_minutes
FROM item_sightings s
JOIN items i ON i.id = s.item_id
JOIN targets t ON t.id = s.target_id
JOIN first_run f ON f.target_id = s.target_id
WHERE s.first_seen_at >= now() - %s AND i.published_at IS NOT NULL
  AND i.published_at >= f.at
GROUP BY 1 ORDER BY 1
"""

COMPLETENESS = """
SELECT s.adapter,
       count(*) AS items,
       avg((i.published_at IS NOT NULL)::int) AS has_time,
       avg((i.body <> '')::int) AS has_body,
       avg((i.author_id IS NOT NULL)::int) AS has_author,
       avg((jsonb_array_length(i.media) > 0)::int) AS has_media,
       avg((cardinality(i.panda_slugs) > 0)::int) AS mentions_panda,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM item_sightings o
         WHERE o.item_id = s.item_id AND o.adapter <> s.adapter)) AS only_here
FROM item_sightings s JOIN items i ON i.id = s.item_id
WHERE s.first_seen_at >= now() - %s
GROUP BY s.adapter ORDER BY s.adapter
"""

ALERTS = """
SELECT adapter, kind, count(*) AS n FROM alerts WHERE raised_at >= now() - %s
GROUP BY adapter, kind ORDER BY adapter, n DESC
"""

#: The plan's acceptance targets (section 7) for discovery latency, by tier.
LATENCY_GOALS_MINUTES = {"official": 30, "key_account": 120}


def _pct(value: Any) -> str:
    return "—" if value is None else f"{float(value) * 100:.0f}%"


def _min(value: Any) -> str:
    # A post dated a little after we saw it is clock skew between us and the platform, not news
    # from the future.
    return "—" if value is None else f"{max(0.0, float(value)):.0f}"


def _table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "（无数据）\n"
    lines = ["", "| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return "\n".join(lines) + "\n"


async def build(store: Store, days: int) -> str:
    window = timedelta(days=days)
    runs = await store.query(RUNS, (window,))
    failures = await store.query(FAILURES, (window,))
    by_adapter = await store.query(LATENCY.format(group="s.adapter"), (window,))
    by_tier = await store.query(LATENCY.format(group="t.tier"), (window,))
    completeness = await store.query(COMPLETENESS, (window,))
    alerts = await store.query(ALERTS, (window,))

    kinds: dict[str, list[str]] = {}
    for f in failures:
        kinds.setdefault(f["adapter"], []).append(f"{f['error_kind']}×{f['n']}")

    parts = [f"# 采集器对比报告（最近 {days} 天）\n"]
    parts.append(
        "## 任务\n\n成功 = 正常返回（含空结果）。空结果单独列出，任务成功不等于内容完整。\n"
    )
    parts.append(
        _table(
            ["采集器", "运行", "成功率", "空结果", "失败", "失败类型", "新增", "修订"],
            [
                [
                    r["adapter"],
                    str(r["runs"]),
                    _pct(r["succeeded"] / r["runs"]) if r["runs"] else "—",
                    str(r["empty"]),
                    str(r["failed"]),
                    "、".join(kinds.get(r["adapter"], [])) or "—",
                    str(r["created"]),
                    str(r["revised"]),
                ]
                for r in runs
            ],
        )
    )
    parts.append("\n## 发现延迟（分钟，发现时间 − 发布时间）\n")
    parts.append(
        _table(
            ["采集器", "条数", "P50", "P95"],
            [
                [r["key"], str(r["items"]), _min(r["p50_minutes"]), _min(r["p95_minutes"])]
                for r in by_adapter
            ],
        )
    )
    parts.append("\n按层级，对照规划书第七节：\n\n")
    parts.append(
        _table(
            ["层级", "条数", "P50", "P95", "目标 P95", "达标"],
            [
                [
                    r["key"],
                    str(r["items"]),
                    _min(r["p50_minutes"]),
                    _min(r["p95_minutes"]),
                    str(LATENCY_GOALS_MINUTES.get(r["key"], "—")),
                    ("是" if r["p95_minutes"] <= LATENCY_GOALS_MINUTES[r["key"]] else "否")
                    if r["key"] in LATENCY_GOALS_MINUTES and r["p95_minutes"] is not None
                    else "—",
                ]
                for r in by_tier
            ],
        )
    )
    parts.append("\n## 数据完整率\n\n“独有”是同一平台上只有这个采集器发现的条数。\n\n")
    parts.append(
        _table(
            ["采集器", "条数", "有发布时间", "有正文", "有作者", "有媒体", "提到熊猫", "独有"],
            [
                [
                    r["adapter"],
                    str(r["items"]),
                    _pct(r["has_time"]),
                    _pct(r["has_body"]),
                    _pct(r["has_author"]),
                    _pct(r["has_media"]),
                    _pct(r["mentions_panda"]),
                    str(r["only_here"]),
                ]
                for r in completeness
            ],
        )
    )
    parts.append("\n## 中断与告警\n\n")
    parts.append(
        _table(["采集器", "类型", "次数"], [[a["adapter"], a["kind"], str(a["n"])] for a in alerts])
    )
    return "".join(parts)
