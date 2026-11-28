"""Option B direct structured news & fact-candidate ingest into services/api."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import httpx

from collector import registry
from collector.extractor import ExtractionError, ExtractionResult, LlmExtractor
from collector.models import Target
from collector.store import Store

log = logging.getLogger(__name__)

SERVICE = "zhipanda_news"
MAX_BATCH = 25

ALLOWED_PLATFORMS = frozenset(
    {"weibo", "douyin", "xiaohongshu", "douban", "bilibili", "web", "x", "wechat"}
)
ROLE_TO_SOURCE_TIER = {
    "institution": "institution",
    "official": "official",
    "media": "media",
    "fan": "fan",
}


def build_account_map(targets: list[Target]) -> dict[tuple[str, str], tuple[str, str | None]]:
    """Map `(platform, account_id)` -> `(sourceTier, institutionSlug)` using target registry."""
    built = registry.build(targets)
    mapping: dict[tuple[str, str], tuple[str, str | None]] = {}
    for entry in built["accounts"]:
        tier = ROLE_TO_SOURCE_TIER.get(entry["role"], "fan")
        mapping[(entry["platform"], str(entry["accountId"]))] = (tier, entry.get("institution"))
    return mapping


def resolve_author_tier(
    row: dict[str, Any],
    account_map: dict[tuple[str, str], tuple[str, str | None]],
) -> tuple[str, str | None]:
    platform = str(row["platform"])
    original = (row.get("item_raw") or {}).get("original_author")
    account_id = (
        original.get("accountId")
        if isinstance(original, dict) and original.get("accountId")
        else row.get("author_id")
    )
    if account_id is None:
        return ("fan", None)
    return account_map.get((platform, str(account_id)), ("fan", None))


def extract_t1_cover_url(row: dict[str, Any], source_tier: str) -> str | None:
    """Strictly keep at most one https cover URL only for T1 institution posts."""
    if source_tier != "institution":
        return None
    for item in row.get("media") or []:
        if not isinstance(item, dict):
            continue
        if item.get("type") not in ("image", "cover"):
            continue
        url = item.get("url")
        if isinstance(url, str) and url.startswith("https://"):
            return url
    return None


def _iso_timestamp(value: Any) -> str:
    if isinstance(value, datetime):
        dt = value if value.tzinfo is not None else value.replace(tzinfo=UTC)
        return dt.astimezone(UTC).isoformat()
    if isinstance(value, str) and value.strip():
        return value.strip()
    return datetime.now(UTC).isoformat()


def to_ingest_item(
    row: dict[str, Any],
    extracted: ExtractionResult,
    source_tier: str,
    author_institution_slug: str | None,
) -> dict[str, Any]:
    platform = str(row["platform"])
    if platform not in ALLOWED_PLATFORMS:
        platform = "web"
    cover_url = extract_t1_cover_url(row, source_tier)
    raw_publisher = str(row.get("author_name") or row.get("target_label") or platform).strip()
    publisher = (raw_publisher or platform)[:120]
    raw_title = str(row.get("title") or "").strip()
    title_zh = (extracted.zh_title.strip() or raw_title or "熊猫动态")[:80]
    summary_zh = (extracted.zh_summary.strip() or raw_title or title_zh)[:300]
    return {
        "externalId": f"{platform}:{row['platform_item_id']}",
        "platform": platform,
        "sourceTier": source_tier,
        "authorInstitutionSlug": author_institution_slug if source_tier == "institution" else None,
        "sourceUrl": str(row["url"]),
        "sourcePublisher": publisher,
        "publishedAt": _iso_timestamp(row.get("published_at") or row.get("first_seen_at")),
        "kind": extracted.kind,
        "scope": extracted.scope,
        "titleZh": title_zh,
        "summaryZh": summary_zh,
        "pandaNames": extracted.panda_names,
        "institutionName": extracted.institution_name,
        "coverUrl": cover_url,
        "factChange": extracted.fact_change.to_payload(),
        "evidenceQuote": extracted.evidence_quote,
    }


async def push(
    store: Store,
    client: httpx.AsyncClient,
    *,
    api_url: str,
    token: str,
    targets: list[Target],
    extractor: LlmExtractor,
) -> int:
    """Claim pending collector outbox rows, structure with LLM, and ingest into services/api."""
    rows = await store.claim_outbox(limit=100)
    if not rows:
        return 0
    account_map = build_account_map(targets)
    settled: set[tuple[int, int]] = set()
    accepted_payloads: list[tuple[tuple[int, int], str, dict[str, Any]]] = []
    skip_keys: list[tuple[int, int]] = []
    ingested = 0

    try:
        for row in rows:
            key = (row["item_id"], row["version"])
            url = str(row.get("url") or "")
            if row.get("target_tier") == "backfill" or not url.startswith("https://"):
                skip_keys.append(key)
                continue

            source_tier, inst_slug = resolve_author_tier(row, account_map)
            published_at = _iso_timestamp(row.get("published_at") or row.get("first_seen_at"))
            publisher = str(row.get("author_name") or row.get("target_label") or row["platform"])
            try:
                extracted = await extractor.extract(
                    title=str(row.get("title") or ""),
                    body=str(row.get("body") or ""),
                    published_at=published_at,
                    source_name=publisher,
                    url=url,
                )
            except ExtractionError as exc:
                await store.mark_push_failed([key], str(exc)[:300])
                settled.add(key)
                continue

            keep = extracted.relevant == "pass" and (
                extracted.worthy_for_news or extracted.fact_change.kind != "none"
            )
            if not keep:
                skip_keys.append(key)
                continue

            accepted_payloads.append(
                (
                    key,
                    str(row["target_id"]),
                    to_ingest_item(row, extracted, source_tier, inst_slug),
                )
            )

        if skip_keys:
            await store.mark_pushed(skip_keys)
            settled.update(skip_keys)

        endpoint = f"{api_url.rstrip('/')}/api/v2/news/ingest"
        for start in range(0, len(accepted_payloads), MAX_BATCH):
            batch = accepted_payloads[start : start + MAX_BATCH]
            keys = [entry[0] for entry in batch]
            target_ids = sorted({entry[1] for entry in batch})
            try:
                response = await client.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                    json={"items": [entry[2] for entry in batch]},
                    timeout=60,
                )
            except httpx.HTTPError as exc:
                await store.mark_push_failed(keys, repr(exc))
                settled.update(keys)
                return ingested

            if response.status_code == 429:
                return ingested
            if response.status_code not in (200, 201):
                error = f"HTTP {response.status_code} {response.text[:200]}"
                await store.mark_push_failed(keys, error)
                settled.update(keys)
                for target_id in target_ids:
                    await store.raise_alert(SERVICE, target_id, "push_failed", error)
                if response.status_code in (401, 403, 500, 502, 503):
                    return ingested
                continue

            await store.mark_pushed(keys)
            settled.update(keys)
            for target_id in target_ids:
                await store.resolve_alerts(SERVICE, target_id)
            ingested += len(batch)

        return ingested
    finally:
        unsettled = [
            (r["item_id"], r["version"])
            for r in rows
            if (r["item_id"], r["version"]) not in settled
        ]
        if unsettled:
            await store.release_outbox(unsettled)
