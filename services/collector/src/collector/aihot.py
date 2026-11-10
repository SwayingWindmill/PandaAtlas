"""Pushes stored versions to AIHOT's external ingest endpoint (POST /api/ingest/items).

AIHOT does cross-platform deduplication, selection, event clustering and hotness. Each collector
target becomes one AIHOT source, so its tier and participation mode are set once in AIHOT's admin.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections import defaultdict
from typing import Any

import httpx

from collector.store import Store

log = logging.getLogger(__name__)

MAX_ITEMS = 50  # AIHOT rejects larger requests with 413.
TIER_LABELS = {
    "official": "官方",
    "key_account": "重点账号",
    "keyword": "关键词",
    "backfill": "补采",
}


def source_id(target_id: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", target_id.lower()).strip("-")[:100]
    if target_id.isascii():
        return f"zhipanda-{slug}"
    # A Chinese keyword leaves nothing in the slug, so the hash keeps such targets apart.
    return f"zhipanda-{slug}-{hashlib.sha1(target_id.encode()).hexdigest()[:8]}"


EXCERPT_CHARS = 200


def _media(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Our media (`type`) in AIHOT's shape (`kind`); only plain image and video links."""
    out = []
    for m in items:
        url, kind = m.get("url"), m.get("type")
        if kind not in ("image", "video") or not isinstance(url, str):
            continue
        if not url.startswith(("http://", "https://")):
            continue
        entry: dict[str, Any] = {"kind": kind, "url": url}
        for dim in ("width", "height"):
            if isinstance(m.get(dim), int) and not isinstance(m[dim], bool):
                entry[dim] = m[dim]
        out.append(entry)
    return out


def _person(platform: str, account_id: Any, name: Any) -> dict[str, Any]:
    return {"platform": platform, "accountId": account_id, "name": name}


def source_name(label: str, tier: str) -> str:
    return f"{label}（{TIER_LABELS.get(tier, '')}）"


def to_item(row: dict[str, Any]) -> dict[str, Any]:
    platform, body = row["platform"], row["body"]
    raw: dict[str, Any] = {
        "platform": platform,
        "body": body,
        "media": row["media"],
        "metrics": row["metrics"],
        "pandaSlugs": row["panda_slugs"],
        "collector": {"itemId": row["item_id"], "version": row["version"]},
        "externalId": f"{platform}:{row['platform_item_id']}",
        "author": _person(platform, row["author_id"], row["author_name"]),
        # History walked by a backfill target must not show up as today's news.
        "_aihot": {"backfill": row["target_tier"] == "backfill"},
    }
    original = (row.get("item_raw") or {}).get("original_author")
    if original:
        raw["originalAuthor"] = _person(platform, original["accountId"], original.get("name"))
    return {
        "title": row["title"] or body[:80] or row["url"],
        "url": row["url"],
        "publishedAt": row["published_at"].isoformat() if row["published_at"] else None,
        "author": row["author_name"],
        "bodyText": body,
        "excerpt": body[:EXCERPT_CHARS],
        "media": _media(row["media"]),
        "raw": raw,
    }


async def push(store: Store, client: httpx.AsyncClient, base_url: str, token: str) -> int:
    rows = await store.pending_outbox(limit=500)
    by_target: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_target[row["target_id"]].append(row)
    pushed = 0
    for target_id, target_rows in by_target.items():
        first = target_rows[0]
        name = source_name(first["target_label"], first["target_tier"])
        for start in range(0, len(target_rows), MAX_ITEMS):
            batch = target_rows[start : start + MAX_ITEMS]
            keys = [(r["item_id"], r["version"]) for r in batch]
            try:
                response = await client.post(
                    f"{base_url.rstrip('/')}/api/ingest/items",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
                        "sourceId": source_id(target_id),
                        "sourceName": name,
                        "items": [to_item(r) for r in batch],
                    },
                    timeout=60,
                )
            except httpx.HTTPError as exc:
                await store.mark_push_failed(keys, repr(exc))
                return pushed
            if response.status_code == 429:
                return pushed  # Next cycle; nothing is lost.
            if response.status_code != 200:
                error = f"HTTP {response.status_code} {response.text[:200]}"
                await store.mark_push_failed(keys, error)
                await store.raise_alert("aihot", target_id, "push_failed", error)
                if response.status_code in (401, 500, 502, 503):
                    return pushed  # The whole endpoint is down or misconfigured.
                break  # 409 paused source or 4xx payload issue: other sources still go.
            await store.mark_pushed(keys)
            await store.resolve_alerts("aihot", target_id)
            pushed += len(batch)
    return pushed
