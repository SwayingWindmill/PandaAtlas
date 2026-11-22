"""Audit live or exported public panda coverage for launch readiness.

Usage:
  python scripts/curation/audit_launch_coverage.py --format markdown
  python scripts/curation/audit_launch_coverage.py --from-export .release-export/2026.10.31.1
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import time
import unicodedata
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_API_BASE = "https://api.zhipanda.com"
DEFAULT_INSTITUTIONS_FILE = ROOT / "data/curation/institutions/institutions.json"
DEFAULT_LEARNING_FILE = ROOT / "data/curation/learning/learning.json"
USER_AGENT = "panda-atlas-curation/1"
COVER_BATCH_SIZE = 50
DETAIL_WORKERS = 4
HTTP_TIMEOUT_SECONDS = 20
HTTP_MAX_ATTEMPTS = 3

# High-interest giant pandas Chinese fans frequently search first.
TOP_FOCUS_PANDAS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("花花（和花）", ("和花", "花花", "he hua", "hua hua")),
    ("和叶", ("和叶", "he ye")),
    ("萌兰", ("萌兰", "meng lan")),
    ("福宝", ("福宝", "fu bao")),
    ("香香", ("香香", "xiang xiang")),
    ("丫丫", ("丫丫", "ya ya")),
    ("飞云", ("飞云", "fei yun")),
    ("金虎", ("金虎", "jin hu")),
    ("渝可", ("渝可", "yu ke")),
    ("渝爱", ("渝爱", "yu ai")),
    ("润玥", ("润玥", "run yue")),
    ("艾伦", ("艾伦", "ai lun")),
    ("宝力", ("宝力", "bao li")),
    ("青宝", ("青宝", "qing bao")),
    ("云川", ("云川", "yun chuan")),
    ("鑫宝", ("鑫宝", "xin bao")),
    ("美香", ("美香", "mei xiang")),
    ("添添", ("添添", "tian tian")),
    ("小奇迹", ("小奇迹", "xiao qi ji")),
    ("蕾蕾", ("蕾蕾", "lei lei")),
    ("晓晓", ("晓晓", "xiao xiao")),
    ("七仔", ("七仔", "qi zai")),
    ("功仔", ("功仔", "gong zai")),
    ("绩笑", ("绩笑", "ji xiao")),
    ("芝麻", ("芝麻", "zhi ma")),
    ("艾莉", ("艾莉", "ai li")),
    ("萌大", ("萌大", "meng da")),
    ("萌二", ("萌二", "meng er")),
    ("白天", ("白天", "bai tian")),
    ("福菀", ("福菀", "福苑", "fu wan")),
    ("奇一", ("奇一", "qi yi")),
    ("奥莉奥", ("奥莉奥", "ao li ao")),
    ("金喜", ("金喜", "jin xi")),
    ("茱萸", ("茱萸", "zhu yu")),
    ("爱宝（华妮）", ("爱宝", "华妮", "ai bao", "hua ni")),
    ("乐宝（园欣）", ("乐宝", "园欣", "le bao", "yuan xin")),
    ("睿宝", ("睿宝", "rui bao")),
    ("辉宝", ("辉宝", "hui bao")),
)

# High-traffic domestic and overseas panda venues to verify against live places/institutions.
CORE_VENUES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    (
        "成都大熊猫繁育研究基地",
        "CN",
        ("chengdu-research-base", "成都大熊猫繁育研究基地", "成都基地"),
    ),
    ("中国大熊猫保护研究中心卧龙神树坪基地", "CN", ("shenshuping", "神树坪")),
    ("中国大熊猫保护研究中心雅安碧峰峡基地", "CN", ("bifengxia", "碧峰峡")),
    (
        "中国大熊猫保护研究中心都江堰基地（中华大熊猫苑）",
        "CN",
        ("ccrcgp-dujiangyan", "中华大熊猫苑", "都江堰基地"),
    ),
    ("成都大熊猫繁育研究基地都江堰野放繁育研究中心（熊猫谷）", "CN", ("panda-valley", "熊猫谷")),
    ("北京动物园", "CN", ("beijing-zoo", "北京动物园")),
    ("重庆动物园", "CN", ("chongqing-zoo", "重庆动物园")),
    ("广州长隆野生动物世界", "CN", ("chimelong", "长隆")),
    ("上海野生动物园", "CN", ("shanghai-wild", "上海野生动物园")),
    ("南京红山森林动物园", "CN", ("hongshan", "红山")),
    ("福州熊猫世界（海峡大熊猫研究交流中心）", "CN", ("fuzhou", "福州")),
    ("陕西秦岭四宝科学公园", "CN", ("qinling", "秦岭四宝", "楼观台")),
    ("大连森林动物园", "CN", ("dalian", "大连森林动物园")),
    ("杭州动物园", "CN", ("hangzhou-zoo", "杭州动物园")),
    ("武汉动物园", "CN", ("wuhan-zoo", "武汉动物园")),
    ("太原动物园", "CN", ("taiyuan-zoo", "太原动物园")),
    ("香港海洋公园", "HK", ("ocean-park", "香港海洋公园")),
    ("台北市立动物园", "TW", ("taipei-zoo", "台北市立动物园")),
    ("日本东京上野动物园", "JP", ("ueno", "上野")),
    ("美国史密森尼国家动物园", "US", ("smithsonian", "national-zoo", "史密森")),
    ("美国圣地亚哥动物园", "US", ("san-diego", "圣地亚哥")),
    ("韩国爱宝乐园", "KR", ("everland", "爱宝乐园")),
    ("新加坡河川生态园", "SG", ("river-wonders", "singapore", "河川生态园")),
    ("马来西亚国家动物园", "MY", ("zoo-negara", "马来西亚国家动物园")),
    ("奥地利维也纳美泉宫动物园", "AT", ("schonbrunn", "vienna", "美泉宫")),
    ("法国博瓦勒动物园", "FR", ("beauval", "博瓦勒")),
    ("德国柏林动物园", "DE", ("berlin-zoo", "柏林动物园")),
)


@dataclass(frozen=True)
class FieldCoverage:
    count: int
    total: int
    percent: float


@dataclass(frozen=True)
class FocusPandaAudit:
    query_name: str
    matched: bool
    canonical_slug: str | None
    display_name: str | None
    from_popular_api: bool
    has_cover: bool
    has_birth_date: bool
    has_sex: bool
    has_life_status: bool
    current_place: str | None
    residency_count: int | None
    lineage_count: int | None
    event_count: int | None
    media_count: int | None
    matched_candidates: list[str]


@dataclass(frozen=True)
class LivePlaceAudit:
    place_id: str
    slug: str
    name: str
    country_code: str | None
    place_type: str
    has_coordinates: bool
    has_visit_guide: bool
    has_viewing_hours: bool
    resident_count: int


@dataclass(frozen=True)
class CoreVenueAudit:
    name: str
    country_code: str
    present_live: bool
    present_in_curation: bool
    matched_place_slugs: list[str]
    has_visit_guide: bool
    resident_count: int


def normalize_key(value: object) -> str:
    if not isinstance(value, str):
        return ""
    text = unicodedata.normalize("NFKC", value).casefold()
    return re.sub(r"[\s_\-:·•()（）]+", "", text)


def percent(count: int, total: int) -> float:
    return round((count / total) * 100.0, 1) if total > 0 else 0.0


VALID_SEX = {"female", "male"}
VALID_LIFE_STATUS = {"alive", "deceased"}


def fact_value(facts: list[dict[str, Any]], key: str) -> Any:
    for fact in facts:
        if fact.get("fieldKey") != key or fact.get("status") == "disputed":
            continue
        value = fact.get("value")
        if value is None:
            continue
        if isinstance(value, str):
            text = value.strip()
            if not text:
                continue
            if key == "sex" and text not in VALID_SEX:
                continue
            if key == "life_status" and text not in VALID_LIFE_STATUS:
                continue
            return text
        return value
    return None


def preferred_panda_name(panda: dict[str, Any]) -> str:
    names = panda.get("names") or []
    for name in names:
        if name.get("languageTag") == "zh-Hans" and name.get("isPrimary"):
            return str(name.get("value") or panda.get("canonicalSlug") or "")
    for name in names:
        if str(name.get("languageTag") or "").startswith("zh"):
            return str(name.get("value") or panda.get("canonicalSlug") or "")
    for name in names:
        if name.get("isPrimary") and name.get("value"):
            return str(name["value"])
    return str(panda.get("canonicalSlug") or panda.get("pandaId") or "")


def place_label(place: dict[str, Any] | None) -> str | None:
    if not isinstance(place, dict):
        return None
    return place.get("nameZh") or place.get("nameEn") or place.get("slug")


def _validate_http_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"Unsupported URL scheme or missing host: {url}")


def default_fetch_json(url: str) -> Any:
    _validate_http_url(url)
    last_error: Exception | None = None
    for attempt in range(1, HTTP_MAX_ATTEMPTS + 1):
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code != 429 and error.code < 500:
                raise
            last_error = error
        except (URLError, ssl.SSLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            last_error = error
        if attempt < HTTP_MAX_ATTEMPTS:
            time.sleep(0.5 * attempt)
    assert last_error is not None
    raise last_error


def fetch_paginated_items(
    fetch_json: Callable[[str], Any],
    base_url: str,
    route: str,
) -> dict[str, Any]:
    separator = "&" if "?" in route else "?"
    first_payload = fetch_json(f"{base_url}{route}")
    if not isinstance(first_payload, dict) or not isinstance(first_payload.get("items"), list):
        return first_payload
    items = list(first_payload["items"])
    cursor = first_payload.get("nextCursor") or (first_payload.get("page") or {}).get("nextCursor")
    seen_cursors: set[str] = set()
    while isinstance(cursor, str) and cursor and cursor not in seen_cursors:
        seen_cursors.add(cursor)
        next_payload = fetch_json(f"{base_url}{route}{separator}{urlencode({'cursor': cursor})}")
        if not isinstance(next_payload, dict):
            break
        batch = next_payload.get("items") or []
        if not batch:
            break
        items.extend(batch)
        cursor = next_payload.get("nextCursor") or (next_payload.get("page") or {}).get(
            "nextCursor"
        )
    return {**first_payload, "items": items}


def load_live_dataset(
    api_base: str,
    fetch_json: Callable[[str], Any] = default_fetch_json,
) -> dict[str, Any]:
    base = api_base.rstrip("/")
    stats = fetch_json(f"{base}/api/v2/stats")
    pandas_doc = fetch_paginated_items(fetch_json, base, "/api/v2/pandas")
    places_doc = fetch_paginated_items(fetch_json, base, "/api/v2/places")
    institutions_doc = fetch_paginated_items(fetch_json, base, "/api/v2/institutions")

    optional: dict[str, Any] = {}
    for key, route, paginated in (
        ("lineage", "/api/v2/lineage", True),
        ("residencies", "/api/v2/residencies", True),
        ("life_events", "/api/v2/life-events", True),
        ("popular", "/api/v2/popular-pandas", False),
        ("learning", "/api/v2/learning", False),
        ("venue_news", "/api/v2/venue-news", False),
        ("overseas_status", "/api/v2/overseas-status", False),
        ("comparisons", "/api/v2/comparisons", False),
    ):
        try:
            optional[key] = (
                fetch_paginated_items(fetch_json, base, route)
                if paginated
                else fetch_json(f"{base}{route}")
            )
        except HTTPError:
            optional[key] = None

    panda_ids = [item["pandaId"] for item in pandas_doc.get("items", []) if item.get("pandaId")]
    cover_ids: set[str] = set()
    batches = [
        panda_ids[i : i + COVER_BATCH_SIZE] for i in range(0, len(panda_ids), COVER_BATCH_SIZE)
    ]
    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as executor:
        futures = [
            executor.submit(fetch_json, f"{base}/api/v2/panda-covers?ids={','.join(batch)}")
            for batch in batches
        ]
        for future in as_completed(futures):
            payload = future.result()
            for item in payload.get("items", []):
                if item.get("pandaId"):
                    cover_ids.add(str(item["pandaId"]))

    return {
        "source_mode": "api",
        "source": base,
        "stats": stats,
        "pandas": pandas_doc,
        "places": places_doc,
        "institutions": institutions_doc,
        "cover_ids": cover_ids,
        "details_by_slug": {},
        **optional,
    }


def _read_optional_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def load_export_dataset(export_dir: Path) -> dict[str, Any]:
    if not export_dir.is_dir():
        raise FileNotFoundError(f"Export directory does not exist: {export_dir}")

    details_by_slug: dict[str, dict[str, Any]] = {}
    cover_ids: set[str] = set()
    details_path = export_dir / "panda-details.jsonl"
    if details_path.exists():
        for line in details_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            detail = json.loads(line)
            panda = detail.get("panda") or {}
            slug = panda.get("canonicalSlug")
            if isinstance(slug, str) and slug:
                details_by_slug[slug] = detail
            if detail.get("media") and panda.get("pandaId"):
                cover_ids.add(str(panda["pandaId"]))

    pandas_doc = _read_optional_json(export_dir / "pandas.json") or {"items": []}
    for panda in pandas_doc.get("items", []):
        if panda.get("hasFullBleedCover") and panda.get("pandaId"):
            cover_ids.add(str(panda["pandaId"]))

    return {
        "source_mode": "export",
        "source": str(export_dir),
        "stats": _read_optional_json(export_dir / "stats.json") or {},
        "pandas": pandas_doc,
        "places": _read_optional_json(export_dir / "places.json") or {"items": []},
        "institutions": _read_optional_json(export_dir / "institutions.json") or {"items": []},
        "lineage": _read_optional_json(export_dir / "lineage.json"),
        "residencies": _read_optional_json(export_dir / "residencies.json"),
        "life_events": _read_optional_json(export_dir / "life-events.json"),
        "learning": _read_optional_json(export_dir / "learning.json"),
        "popular": _read_optional_json(export_dir / "popular-pandas.json"),
        "venue_news": _read_optional_json(export_dir / "venue-news.json"),
        "overseas_status": _read_optional_json(export_dir / "overseas-status.json"),
        "comparisons": _read_optional_json(export_dir / "comparisons.json"),
        "cover_ids": cover_ids,
        "details_by_slug": details_by_slug,
    }


def _panda_terms(panda: dict[str, Any]) -> set[str]:
    terms = {normalize_key(panda.get("canonicalSlug"))}
    for slug in panda.get("legacySlugs") or []:
        terms.add(normalize_key(slug))
    for name in panda.get("names") or []:
        terms.add(normalize_key(name.get("value")))
    terms.discard("")
    return terms


def _match_tier(panda: dict[str, Any], normalized_aliases: set[str]) -> int:
    slug_norm = normalize_key(panda.get("canonicalSlug"))
    zh_names = {
        normalize_key(name.get("value"))
        for name in (panda.get("names") or [])
        if str(name.get("languageTag") or "").startswith("zh")
    }
    if slug_norm in normalized_aliases or (zh_names & normalized_aliases):
        return 0
    terms = _panda_terms(panda)
    if terms & normalized_aliases:
        return 1
    if any(alias in term for alias in normalized_aliases if len(alias) >= 2 for term in terms):
        return 2
    return 3


def _find_matching_pandas(
    pandas: list[dict[str, Any]],
    aliases: tuple[str, ...],
) -> list[tuple[int, dict[str, Any]]]:
    normalized_aliases = {normalize_key(alias) for alias in aliases if normalize_key(alias)}
    best_by_tier: dict[int, list[dict[str, Any]]] = {0: [], 1: [], 2: []}
    for panda in pandas:
        tier = _match_tier(panda, normalized_aliases)
        if tier <= 2:
            best_by_tier[tier].append(panda)
    for tier in (0, 1, 2):
        if best_by_tier[tier]:
            return [(tier, p) for p in best_by_tier[tier]]
    return []


def _score_panda_richness(
    panda: dict[str, Any],
    cover_ids: set[str],
    residency_counts: dict[str, int],
    lineage_counts: dict[str, int],
    event_counts: dict[str, int],
) -> tuple[int, int, int, int]:
    pid = str(panda.get("pandaId") or "")
    facts = panda.get("facts") or []
    return (
        1 if pid in cover_ids else 0,
        1 if panda.get("currentPlace") else 0,
        residency_counts.get(pid, 0) + lineage_counts.get(pid, 0) + event_counts.get(pid, 0),
        len(facts),
    )


def _fetch_focus_details(
    dataset: dict[str, Any],
    slugs: list[str],
    fetch_json: Callable[[str], Any],
) -> dict[str, dict[str, Any]]:
    details = dict(dataset.get("details_by_slug") or {})
    if dataset.get("source_mode") != "api":
        return details
    base = str(dataset["source"]).rstrip("/")
    missing = list(dict.fromkeys(slug for slug in slugs if slug and slug not in details))
    if not missing:
        return details

    def load_one(slug: str) -> tuple[str, dict[str, Any] | None]:
        try:
            return slug, fetch_json(f"{base}/api/v2/pandas/{quote(slug, safe='')}")
        except HTTPError:
            return slug, None

    with ThreadPoolExecutor(max_workers=DETAIL_WORKERS) as executor:
        futures = [executor.submit(load_one, slug) for slug in missing]
        for future in as_completed(futures):
            slug, payload = future.result()
            if isinstance(payload, dict):
                details[slug] = payload
    return details


def _count_relation_maps(
    dataset: dict[str, Any],
) -> tuple[dict[str, int], dict[str, int], dict[str, int]]:
    residency_counts: dict[str, int] = {}
    for row in (dataset.get("residencies") or {}).get("items", []):
        pid = row.get("pandaId")
        if pid:
            residency_counts[pid] = residency_counts.get(pid, 0) + 1

    lineage_counts: dict[str, int] = {}
    for row in (dataset.get("lineage") or {}).get("items", []):
        for key in ("childId", "parentId"):
            pid = row.get(key)
            if pid:
                lineage_counts[pid] = lineage_counts.get(pid, 0) + 1

    event_counts: dict[str, int] = {}
    for row in (dataset.get("life_events") or {}).get("items", []):
        for pid in row.get("participantIds") or []:
            if pid:
                event_counts[pid] = event_counts.get(pid, 0) + 1

    return residency_counts, lineage_counts, event_counts


def _curation_institutions(path: Path | None) -> list[dict[str, Any]]:
    if path is None or not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, dict):
        return list(raw.get("institutions") or [])
    return []


def _local_learning_summary(path: Path | None) -> dict[str, Any] | None:
    if path is None or not path.exists():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return None
    counts = {}
    for key in ("articles", "terms", "faceGuides", "challenges", "monthThemes"):
        entries = raw.get(key)
        if isinstance(entries, list):
            counts[key] = sum(
                1
                for entry in entries
                if isinstance(entry, dict) and entry.get("status") == "published"
            )
    return {"version": raw.get("version"), "published": counts}


def _catalog_counts(dataset: dict[str, Any]) -> dict[str, Any]:
    learning = dataset.get("learning")
    learning_counts = None
    if isinstance(learning, dict):
        learning_counts = {
            "version": learning.get("version"),
            "articles": len(learning.get("articles") or []),
            "terms": len(learning.get("terms") or []),
            "faceGuides": len(learning.get("faceGuides") or []),
            "challenges": len(learning.get("challenges") or []),
            "monthThemes": len(learning.get("monthThemes") or []),
        }

    def simple_catalog(doc: Any) -> dict[str, Any] | None:
        if not isinstance(doc, dict):
            return None
        return {"version": doc.get("version") or "", "count": len(doc.get("items") or [])}

    return {
        "learning": learning_counts,
        "venue_news": simple_catalog(dataset.get("venue_news")),
        "overseas_status": simple_catalog(dataset.get("overseas_status")),
        "comparisons": simple_catalog(dataset.get("comparisons")),
        "popular_pandas": (
            {
                "windowDays": dataset["popular"].get("windowDays"),
                "count": len(dataset["popular"].get("items") or []),
            }
            if isinstance(dataset.get("popular"), dict)
            else None
        ),
    }


def _audit_venues(
    places: list[dict[str, Any]],
    pandas: list[dict[str, Any]],
    curation_institutions: list[dict[str, Any]],
) -> tuple[list[LivePlaceAudit], list[CoreVenueAudit]]:
    residents_by_place: dict[str, int] = {}
    for panda in pandas:
        place = panda.get("currentPlace")
        pid = place.get("placeId") if isinstance(place, dict) else None
        if pid:
            residents_by_place[pid] = residents_by_place.get(pid, 0) + 1

    live_places = [
        LivePlaceAudit(
            place_id=str(place.get("placeId") or ""),
            slug=str(place.get("slug") or ""),
            name=str(place.get("nameZh") or place.get("nameEn") or place.get("slug") or ""),
            country_code=place.get("countryCode"),
            place_type=str(place.get("placeType") or ""),
            has_coordinates=place.get("longitude") is not None
            and place.get("latitude") is not None,
            has_visit_guide=bool(place.get("visitGuide")),
            has_viewing_hours=bool((place.get("visitGuide") or {}).get("viewing")),
            resident_count=residents_by_place.get(str(place.get("placeId") or ""), 0),
        )
        for place in places
    ]

    curation_tokens: set[str] = set()
    for inst in curation_institutions:
        for val in (inst.get("slug"), inst.get("nameZh"), inst.get("nameEn")):
            if norm := normalize_key(val):
                curation_tokens.add(norm)
        for p in inst.get("places") or []:
            if norm := normalize_key(p.get("slug")):
                curation_tokens.add(norm)
            for legacy in p.get("legacySlugs") or []:
                if norm := normalize_key(legacy):
                    curation_tokens.add(norm)

    core_audits: list[CoreVenueAudit] = []
    facility_places = [live for live in live_places if live.place_type == "facility"]
    for venue_name, country_code, aliases in CORE_VENUES:
        normalized_aliases = [normalize_key(a) for a in aliases if normalize_key(a)]
        matched_live: list[LivePlaceAudit] = []
        for live in facility_places:
            haystack = " ".join(filter(None, [normalize_key(live.slug), normalize_key(live.name)]))
            if any(alias in haystack for alias in normalized_aliases):
                matched_live.append(live)
        in_curation = any(
            alias in token for alias in normalized_aliases for token in curation_tokens
        )
        core_audits.append(
            CoreVenueAudit(
                name=venue_name,
                country_code=country_code,
                present_live=bool(matched_live),
                present_in_curation=in_curation,
                matched_place_slugs=[item.slug for item in matched_live],
                has_visit_guide=any(item.has_visit_guide for item in matched_live),
                resident_count=sum(item.resident_count for item in matched_live),
            )
        )
    return live_places, core_audits


def analyze_coverage(
    dataset: dict[str, Any],
    institutions_file: Path | None = DEFAULT_INSTITUTIONS_FILE,
    learning_file: Path | None = DEFAULT_LEARNING_FILE,
    fetch_json: Callable[[str], Any] = default_fetch_json,
) -> dict[str, Any]:
    pandas = list((dataset.get("pandas") or {}).get("items") or [])
    places = list((dataset.get("places") or {}).get("items") or [])
    institutions = list((dataset.get("institutions") or {}).get("items") or [])
    cover_ids: set[str] = set(dataset.get("cover_ids") or set())
    residency_counts, lineage_counts, event_counts = _count_relation_maps(dataset)

    total = len(pandas)
    with_cover = sum(1 for p in pandas if str(p.get("pandaId") or "") in cover_ids)
    with_life = sum(
        1 for p in pandas if fact_value(p.get("facts") or [], "life_status") is not None
    )
    with_sex = sum(1 for p in pandas if fact_value(p.get("facts") or [], "sex") is not None)
    with_birth = sum(
        1 for p in pandas if fact_value(p.get("facts") or [], "birth_date") is not None
    )
    with_death = sum(
        1 for p in pandas if fact_value(p.get("facts") or [], "death_date") is not None
    )
    with_place = sum(1 for p in pandas if bool(p.get("currentPlace")))

    popular_items = (dataset.get("popular") or {}).get("items") or []
    popular_by_id = {
        str(item.get("pandaId")): item for item in popular_items if item.get("pandaId")
    }
    panda_by_id = {str(p.get("pandaId")): p for p in pandas if p.get("pandaId")}

    focus_targets: list[tuple[str, list[dict[str, Any]], bool]] = []
    seen_panda_ids: set[str] = set()

    for item in popular_items:
        pid = str(item.get("pandaId") or "")
        panda = panda_by_id.get(pid)
        if panda is None:
            continue
        seen_panda_ids.add(pid)
        focus_targets.append((preferred_panda_name(panda), [panda], True))

    for label, aliases in TOP_FOCUS_PANDAS:
        tiered = _find_matching_pandas(pandas, aliases)
        tiered.sort(
            key=lambda item: (
                -item[0],
                *_score_panda_richness(
                    item[1], cover_ids, residency_counts, lineage_counts, event_counts
                ),
            ),
            reverse=True,
        )
        matches = [item[1] for item in tiered]
        if matches and str(matches[0].get("pandaId") or "") in seen_panda_ids:
            continue
        if matches:
            seen_panda_ids.add(str(matches[0].get("pandaId") or ""))
        focus_targets.append(
            (label, matches, bool(matches and str(matches[0].get("pandaId")) in popular_by_id))
        )

    detail_slugs = [
        str(matches[0]["canonicalSlug"])
        for _, matches, _ in focus_targets
        if matches and matches[0].get("canonicalSlug")
    ]
    details_by_slug = _fetch_focus_details(dataset, detail_slugs, fetch_json)

    focus_audits: list[FocusPandaAudit] = []
    for query_name, matches, is_popular in focus_targets:
        if not matches:
            focus_audits.append(
                FocusPandaAudit(
                    query_name=query_name,
                    matched=False,
                    canonical_slug=None,
                    display_name=None,
                    from_popular_api=False,
                    has_cover=False,
                    has_birth_date=False,
                    has_sex=False,
                    has_life_status=False,
                    current_place=None,
                    residency_count=None,
                    lineage_count=None,
                    event_count=None,
                    media_count=None,
                    matched_candidates=[],
                )
            )
            continue

        primary = matches[0]
        pid = str(primary.get("pandaId") or "")
        slug = str(primary.get("canonicalSlug") or "")
        facts = primary.get("facts") or []
        detail = details_by_slug.get(slug)
        res_loaded = isinstance(dataset.get("residencies"), dict)
        lin_loaded = isinstance(dataset.get("lineage"), dict)
        evt_loaded = isinstance(dataset.get("life_events"), dict)
        res_count = (
            len(detail.get("residencies") or [])
            if detail is not None
            else (residency_counts.get(pid, 0) if res_loaded else None)
        )
        lin_count = (
            len(detail.get("lineage") or [])
            if detail is not None
            else (lineage_counts.get(pid, 0) if lin_loaded else None)
        )
        evt_count = (
            len(detail.get("events") or [])
            if detail is not None
            else (event_counts.get(pid, 0) if evt_loaded else None)
        )
        media_count = (
            len(detail.get("media") or []) if detail is not None else (1 if pid in cover_ids else 0)
        )
        has_cover = pid in cover_ids or bool(detail and detail.get("media"))

        focus_audits.append(
            FocusPandaAudit(
                query_name=query_name,
                matched=True,
                canonical_slug=slug,
                display_name=preferred_panda_name(primary),
                from_popular_api=is_popular,
                has_cover=has_cover,
                has_birth_date=fact_value(facts, "birth_date") is not None,
                has_sex=fact_value(facts, "sex") is not None,
                has_life_status=fact_value(facts, "life_status") is not None,
                current_place=place_label(primary.get("currentPlace")),
                residency_count=res_count,
                lineage_count=lin_count,
                event_count=evt_count,
                media_count=media_count,
                matched_candidates=[
                    str(item.get("canonicalSlug")) for item in matches if item.get("canonicalSlug")
                ],
            )
        )

    curation_institutions = _curation_institutions(institutions_file)
    live_places, core_venues = _audit_venues(places, pandas, curation_institutions)

    stats_block = dataset.get("stats") or {}
    release_info = stats_block.get("release") or (dataset.get("pandas") or {}).get("release") or {}

    return {
        "source": {"mode": dataset.get("source_mode"), "location": dataset.get("source")},
        "release": {
            "releaseId": release_info.get("releaseId"),
            "version": release_info.get("version"),
        },
        "stats": stats_block.get("stats")
        or {
            "pandaCount": total,
            "institutionCount": len(institutions),
            "placeCount": len(places),
            "lineageCount": len((dataset.get("lineage") or {}).get("items") or []),
            "residencyCount": len((dataset.get("residencies") or {}).get("items") or []),
            "lifeEventCount": len((dataset.get("life_events") or {}).get("items") or []),
        },
        "catalogs": _catalog_counts(dataset),
        "local_learning": _local_learning_summary(learning_file),
        "field_coverage": {
            "cover_photo": asdict(FieldCoverage(with_cover, total, percent(with_cover, total))),
            "life_status": asdict(FieldCoverage(with_life, total, percent(with_life, total))),
            "sex": asdict(FieldCoverage(with_sex, total, percent(with_sex, total))),
            "birth_date": asdict(FieldCoverage(with_birth, total, percent(with_birth, total))),
            "death_date": asdict(FieldCoverage(with_death, total, percent(with_death, total))),
            "current_place": asdict(FieldCoverage(with_place, total, percent(with_place, total))),
        },
        "focus_pandas": [asdict(item) for item in focus_audits],
        "live_places": [asdict(item) for item in live_places],
        "core_venues": [asdict(item) for item in core_venues],
    }


def _yn(flag: bool) -> str:
    return "有" if flag else "**缺**"


def render_markdown(report: dict[str, Any]) -> str:
    release = report["release"]
    stats = report["stats"]
    catalogs = report["catalogs"]
    local_learning = report.get("local_learning")
    lines: list[str] = [
        "# 吱熊猫上线内容覆盖率诊断报告",
        "",
        f"- 数据源：`{report['source']['mode']}`（`{report['source']['location']}`）",
        f"- 当前线上版本：`{release.get('version') or '未知'}`"
        f"（`{release.get('releaseId') or 'N/A'}`）",
        "",
        "## 1. 发布版本与总览",
        "",
        f"- 实体总量：熊猫 **{stats.get('pandaCount', 0)}** 只"
        f" / 机构 **{stats.get('institutionCount', 0)}** 家"
        f" / 地点 **{stats.get('placeCount', 0)}** 个"
        f" / 居住记录 **{stats.get('residencyCount', 0)}** 条"
        f" / 血缘 **{stats.get('lineageCount', 0)}** 条"
        f" / 生平事件 **{stats.get('lifeEventCount', 0)}** 条",
    ]
    if stats.get("mediaCount") is not None:
        lines.append(
            f"- 媒体与来源：媒体 **{stats.get('mediaCount')}** 条"
            f" / 证据来源 **{stats.get('evidenceSourceCount')}** 条"
        )

    learning = catalogs.get("learning")
    if learning:
        local_hint = (
            f"（本地 `learning.json` 为 `{local_learning.get('version')}`，"
            f"含已发布文章 {local_learning['published'].get('articles', 0)}"
            f" / 词条 {local_learning['published'].get('terms', 0)}）"
            if local_learning
            else ""
        )
        lag = (
            " ⚠️ **落后于仓库版本**"
            if local_learning
            and local_learning.get("version")
            and local_learning.get("version") != learning.get("version")
            else ""
        )
        lines.append(
            f"- 科普目录（`learning`）：线上 `{learning.get('version')}`"
            f" — 文章 {learning.get('articles')}、词条 {learning.get('terms')}、"
            f"认脸指南 {learning.get('faceGuides')}、认脸挑战 {learning.get('challenges')}、"
            f"月度主题 {learning.get('monthThemes')}{local_hint}{lag}"
        )

    for key, label in (
        ("venue_news", "场馆动态（`venue-news`）"),
        ("overseas_status", "海外/归国状态（`overseas-status`）"),
        ("comparisons", "比一比（`comparisons`）"),
        ("popular_pandas", "热门熊猫（`popular-pandas`）"),
    ):
        item = catalogs.get(key)
        if item is not None:
            ver = (
                f"版本 `{item.get('version') or '空'}`，"
                if "version" in item
                else f"窗口 {item.get('windowDays')} 天，"
            )
            lines.append(f"- {label}：{ver}共 **{item.get('count', 0)}** 条")

    lines.extend(
        [
            "",
            "## 2. 全量字段覆盖率",
            "",
            "| 字段 | 已覆盖 | 总数 | 占比 |",
            "| --- | ---: | ---: | ---: |",
        ]
    )
    field_labels = (
        ("cover_photo", "封面图"),
        ("life_status", "生死状态 (`life_status`)"),
        ("sex", "性别 (`sex`)"),
        ("birth_date", "出生日期 (`birth_date`)"),
        ("death_date", "离世日期 (`death_date`)"),
        ("current_place", "当前场馆 (`currentPlace`)"),
    )
    for key, label in field_labels:
        cov = report["field_coverage"][key]
        lines.append(f"| {label} | {cov['count']} | {cov['total']} | {cov['percent']}% |")

    focus = report["focus_pandas"]
    matched = [item for item in focus if item["matched"]]
    missing = [item for item in focus if not item["matched"]]
    lines.extend(
        [
            "",
            f"## 3. 头部重点熊猫缺口表（命中 {len(matched)} / {len(focus)}）",
            "",
            "| 关注名 | 线上 Slug | 显示名 | 封面 | 生日 | 性别 | 当前场馆 | 居住 | 血缘 | 事件"
            " | 备注 |",
            "| --- | --- | --- | :---: | :---: | :---: | --- | ---: | ---: | ---: | --- |",
        ]
    )
    for item in matched:
        extra = ""
        if len(item["matched_candidates"]) > 1:
            extra = f"候选 {len(item['matched_candidates'])} 个"
        if item["from_popular_api"]:
            extra = f"{extra} 热门榜".strip()
        place_text = item["current_place"] or "**缺**"
        res_text = item["residency_count"] if item["residency_count"] is not None else "-"
        lin_text = item["lineage_count"] if item["lineage_count"] is not None else "-"
        evt_text = item["event_count"] if item["event_count"] is not None else "-"
        lines.append(
            f"| {item['query_name']} | `{item['canonical_slug']}` | {item['display_name']}"
            f" | {_yn(item['has_cover'])} | {_yn(item['has_birth_date'])}"
            f" | {_yn(item['has_sex'])} | {place_text} | {res_text}"
            f" | {lin_text} | {evt_text} | {extra} |"
        )
    if missing:
        lines.append("")
        lines.append(
            f"- **未命中 / 未收录（{len(missing)} 只）**："
            + "、".join(item["query_name"] for item in missing)
        )

    live_places = report["live_places"]
    core_venues = report["core_venues"]
    missing_core = [venue for venue in core_venues if not venue["present_live"]]
    present_core = [venue for venue in core_venues if venue["present_live"]]
    lines.extend(
        [
            "",
            f"## 4. 核心场馆覆盖与缺口（线上地点 {len(live_places)} 个，"
            f"核心参考 {len(present_core)} / {len(core_venues)}）",
            "",
            "### 4.1 线上已有地点体检",
            "",
            "| Slug | 名称 | 国家 | 类型 | 坐标 | 参观指南 | 观猫时段 | 在住熊猫数 |",
            "| --- | --- | :---: | --- | :---: | :---: | :---: | ---: |",
        ]
    )
    for place in live_places:
        lines.append(
            f"| `{place['slug']}` | {place['name']} | {place['country_code'] or '-'}"
            f" | {place['place_type']} | {_yn(place['has_coordinates'])}"
            f" | {_yn(place['has_visit_guide'])} | {_yn(place['has_viewing_hours'])}"
            f" | {place['resident_count']} |"
        )

    lines.extend(["", f"### 4.2 核心参考场馆缺失清单（{len(missing_core)} 家未上线）", ""])
    for venue in missing_core:
        curation_tag = (
            "（已入本地 curation）" if venue["present_in_curation"] else "（本地 curation 也缺）"
        )
        lines.append(f"- `{venue['country_code']}` {venue['name']} {curation_tag}")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--api-base", help=f"Public API base URL (default: {DEFAULT_API_BASE})")
    source.add_argument(
        "--from-export", type=Path, help="Read from an offline release export directory"
    )
    parser.add_argument("--institutions-file", type=Path, default=DEFAULT_INSTITUTIONS_FILE)
    parser.add_argument("--learning-file", type=Path, default=DEFAULT_LEARNING_FILE)
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    parser.add_argument("--output", type=Path, help="Write report to a file")
    args = parser.parse_args(argv)

    dataset = (
        load_export_dataset(args.from_export)
        if args.from_export is not None
        else load_live_dataset(args.api_base or DEFAULT_API_BASE)
    )
    report = analyze_coverage(
        dataset,
        institutions_file=args.institutions_file,
        learning_file=args.learning_file,
    )
    rendered = (
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
        if args.format == "json"
        else render_markdown(report)
    )
    if args.output is not None:
        args.output.write_text(rendered, encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
