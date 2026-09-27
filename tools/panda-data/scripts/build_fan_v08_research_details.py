from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.research.audit_local_panda_research_coverage import (
    _canonical_subject_aliases,
    _canonical_subject_id,
    _source_family_map,
    _superseded_bounded_subject_ids,
    media_row_is_confirmed_subject_depiction,
)
from scripts.research.build_information_collection_queue import _load_vault

DEFAULT_CATALOG = ROOT / ".ai-bridge/fan-v08-research-catalog.json"
DEFAULT_OUTPUT = ROOT / ".ai-bridge/fan-v08-research-details.json"
IDENTITY_MERGES = ROOT / "data/local-panda-research/identity-merges.json"
SCHEMA_VERSION = 2

BLOCKED_REVIEW_MARKERS = (
    "needs_",
    "open_",
    "conflict",
    "disputed",
    "rejected",
    "superseded",
    "withheld",
)
CORE_PREDICATES: dict[str, set[str]] = {
    "birth_date": {"birth_date", "date_of_birth"},
    "sex": {"sex", "current_canonical_sex"},
    "birthplace": {"birthplace", "birth_place"},
    "studbook_number": {
        "international_studbook_number",
        "studbook_number",
        "studbook_id",
    },
    "life_status": {"life_status", "alive_status", "deceased_status"},
    "death_date": {"death_date"},
}
RELATION_CATEGORIES = {"relationship", "lineage", "social_relationship"}
TIMELINE_CATEGORIES = {
    "birth",
    "birth_event",
    "death",
    "transfer",
    "location",
    "residency_history",
    "public_debut",
    "reproduction",
    "maternal_care",
    "health",
    "veterinary_care",
    "milestone",
    "growth_measurement",
    "hand_rearing",
    "behaviour",
    "behavior",
    "enrichment",
    "conservation",
    "diplomacy",
    "rescue",
    "release",
    "research",
}
HIGHLIGHT_EXCLUDED_PREDICATES = set().union(*CORE_PREDICATES.values()) | {
    "official_name",
    "official_name_form",
    "official_current_name_form",
    "official_chinese_name_form",
    "official_romanised_name_form",
}
CLASSIFICATION_CATEGORIES = {
    "residence",
    "residency_history",
    "transfer",
    "husbandry",
    "husbandry_training",
    "enrichment",
    "public_debut",
    "diplomacy",
    "rescue",
    "release",
    "training",
    "conservation",
    "wild_monitoring",
}
CLASSIFICATION_PREDICATE_RE = re.compile(
    r"(?:released?_to_wild|wild_return|wild_release|translocated_release|wild_rescue_release|"
    r"wild[_ -]?training_current|wildtraining_current|current_wildtraining|rewilding_training|"
    r"reintroduction_candidate|named_wildtraining|bounded_wildtraining_identity|wild_training_observation|"
    r"wild_tracking_identity|collared_wild_(?:female|male)_identity|wild_(?:female|male|individual)_identity)",
    re.I,
)
HIGHLIGHT_CATEGORY_PRIORITY = {
    "identity": 0,
    "appearance": 1,
    "personality": 2,
    "behaviour": 3,
    "behavior": 3,
    "preference": 4,
    "hand_rearing": 5,
    "maternal_care": 6,
    "reproduction": 7,
    "health": 8,
    "veterinary_care": 8,
    "milestone": 9,
    "growth": 10,
    "growth_measurement": 10,
    "social": 11,
    "social_relationship": 11,
    "enrichment": 12,
    "husbandry_training": 13,
    "diet": 14,
    "research": 15,
    "conservation": 16,
    "cultural_context": 17,
    "diplomacy": 18,
    "rescue": 19,
    "release": 19,
    "name_meaning": 20,
}
DATE_VALUE_KEYS = (
    "event_date",
    "occurred_on",
    "date",
    "birth_date",
    "death_date",
    "transfer_date",
    "move_date",
    "arrival_date",
    "return_date",
    "observed_on",
    "observed_at",
    "start_date",
    "start_on",
)
DATE_LIKE_RE = re.compile(r"^\d{4}-\d{2}(?:-\d{2})?(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build the V8 panda detail projection from the research vault."
    )
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--pretty", action="store_true")
    return parser.parse_args()


def _load_catalog(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("pandas"), list):
        raise ValueError(f"Invalid fan V08 catalog: {path}")
    return payload


def _identity_merge_aliases(catalog_rows: list[dict[str, Any]]) -> dict[str, str]:
    if not IDENTITY_MERGES.exists():
        return {}
    try:
        payload = json.loads(IDENTITY_MERGES.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    rows = payload.get("merges", []) if isinstance(payload, dict) else []
    catalog_id_by_slug = {
        str(row.get("slug")): str(row.get("id"))
        for row in catalog_rows
        if row.get("slug") and row.get("id")
    }
    catalog_ids = {str(row.get("id")) for row in catalog_rows if row.get("id")}
    aliases: dict[str, str] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        canonical_slug = str(row.get("canonical_slug") or "").strip()
        if not canonical_slug:
            continue
        canonical_id = catalog_id_by_slug.get(canonical_slug)
        if canonical_id is None and canonical_slug in catalog_ids:
            canonical_id = canonical_slug
        if canonical_id is None:
            canonical_id = canonical_slug
        for key in ("subject_ids", "duplicate_slugs"):
            for alias in row.get(key, []) or []:
                if isinstance(alias, str) and alias and alias != canonical_id:
                    aliases[alias] = canonical_id
    return aliases


def _subject(row: dict[str, Any]) -> tuple[str, str] | None:
    value = row.get("subject")
    if not isinstance(value, dict) or value.get("type") != "panda" or not value.get("id"):
        return None
    subject_id = str(value["id"])
    return subject_id, str(value.get("label") or subject_id)


def _review_is_safe(row: dict[str, Any]) -> bool:
    evidence = str(row.get("evidence_level") or "").casefold()
    if evidence != "direct" and not evidence.startswith("direct_"):
        return False
    if str(row.get("confidence") or "high").casefold() not in {"high", "very_high"}:
        return False
    if str(row.get("category") or "").casefold() == "conflict":
        return False
    review = str(row.get("review_status") or "").casefold()
    return not any(marker in review for marker in BLOCKED_REVIEW_MARKERS)


def _stable_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _core_value_key(value: Any) -> str:
    if isinstance(value, str):
        normalized = value.strip()
        if re.fullmatch(r"[+-]?\d+", normalized):
            return f"number:{int(normalized)}"
        return f"string:{normalized.casefold()}"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"number:{value:g}"
    return _stable_json(value)


def _unique_core_value(rows: Iterable[dict[str, Any]], predicates: set[str]) -> Any | None:
    candidates: dict[str, Any] = {}
    for row in rows:
        if str(row.get("predicate") or "").casefold() not in predicates:
            continue
        value = row.get("value")
        if value in (None, ""):
            continue
        candidates.setdefault(_core_value_key(value), value)
    if len(candidates) != 1:
        return None
    return next(iter(candidates.values()))


def _extract_date_from_value(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in DATE_VALUE_KEYS:
            candidate = value.get(key)
            if isinstance(candidate, str) and DATE_LIKE_RE.match(candidate.strip()):
                return candidate.strip()[:10]
        for child in value.values():
            candidate = _extract_date_from_value(child)
            if candidate:
                return candidate
    elif isinstance(value, list):
        for child in value:
            candidate = _extract_date_from_value(child)
            if candidate:
                return candidate
    return None


def _record_date(row: dict[str, Any]) -> str | None:
    value = row.get("value")
    category = str(row.get("category") or "").casefold()
    predicate = str(row.get("predicate") or "").casefold()
    if isinstance(value, str) and DATE_LIKE_RE.match(value.strip()):
        if category in TIMELINE_CATEGORIES or any(
            marker in predicate
            for marker in ("date", "birth", "death", "mating", "transfer", "arrival", "return", "debut", "observ")
        ):
            return value.strip()[:10]
    return _extract_date_from_value(value)


def _relation_target(value: Any) -> tuple[str | None, str | None]:
    if isinstance(value, dict):
        subject_id = value.get("subject_id") or value.get("panda_id") or value.get("target_subject_id")
        label = value.get("label") or value.get("name") or value.get("subject_label")
        return (
            str(subject_id) if isinstance(subject_id, str) and subject_id else None,
            str(label) if isinstance(label, str) and label else None,
        )
    if isinstance(value, str) and value.strip():
        return None, value.strip()
    return None, None


def _relation_kind(predicate: str) -> str:
    normalized = predicate.casefold()
    aliases = {
        "dam": "mother",
        "maternal_parent": "mother",
        "sire": "father",
        "paternal_parent": "father",
        "offspring": "child",
        "daughter": "child",
        "son": "child",
        "twin_sister": "sibling",
        "twin_brother": "sibling",
        "sister": "sibling",
        "brother": "sibling",
    }
    if normalized in aliases:
        return aliases[normalized]
    if any(marker in normalized for marker in ("twin", "sibling", "brother", "sister")):
        return "sibling"
    if any(marker in normalized for marker in ("mother", "maternal", "dam")) and "_of" not in normalized:
        return "mother"
    if any(marker in normalized for marker in ("father", "paternal", "sire")) and "_of" not in normalized:
        return "father"
    if "parent" in normalized and "_of" not in normalized:
        return "parent"
    if any(marker in normalized for marker in ("offspring", "child", "daughter", "son", "mother_of", "father_of", "sired")):
        return "child"
    return normalized


def _relation_targets(value: Any, predicate: str) -> list[tuple[str, str | None, str | None]]:
    """Extract only relation shapes whose perspective is unambiguous for the current subject."""
    if not isinstance(value, dict):
        target_id, target_label = _relation_target(value)
        kind = _relation_kind(predicate)
        return [(kind, target_id, target_label)] if (target_id or target_label) else []

    targets: list[tuple[str, str | None, str | None]] = []
    seen: set[tuple[str, str | None, str | None]] = set()

    def add(kind: str, target_id: Any = None, target_label: Any = None) -> None:
        raw_id = str(target_id).strip() if isinstance(target_id, str) and target_id.strip() else None
        raw_label = str(target_label).strip() if isinstance(target_label, str) and target_label.strip() else None
        if not raw_id and not raw_label:
            return
        key = (kind, raw_id, raw_label)
        if key not in seen:
            seen.add(key)
            targets.append(key)

    def nested(value_or_mapping: Any) -> tuple[str | None, str | None]:
        if isinstance(value_or_mapping, dict):
            return _relation_target(value_or_mapping)
        if isinstance(value_or_mapping, str) and value_or_mapping.strip():
            return value_or_mapping.strip(), None
        return None, None

    generic_id, generic_label = _relation_target(value)
    generic_kind = _relation_kind(predicate)
    if generic_id or generic_label:
        add(generic_kind, generic_id, generic_label)

    normalized = predicate.casefold()
    subject_is_parent_context = any(
        marker in normalized
        for marker in ("mother_of", "father_of", "sired", "gave_birth", "offspring", "children")
    ) or any(key in value for key in ("offspring_id", "offspring_subject_id", "offspring_ids", "offspring_subject_ids"))

    if not subject_is_parent_context:
        mother_id = value.get("mother_id") or value.get("mother_subject_id")
        mother_label = value.get("mother_label") or value.get("mother_name") or value.get("reported_mother_name")
        if value.get("mother") is not None:
            nested_id, nested_label = nested(value.get("mother"))
            mother_id = mother_id or nested_id
            mother_label = mother_label or nested_label
        add("mother", mother_id, mother_label)

        father_id = value.get("father_id") or value.get("father_subject_id")
        father_label = value.get("father_label") or value.get("father_name") or value.get("reported_father_name")
        if value.get("father") is not None:
            nested_id, nested_label = nested(value.get("father"))
            father_id = father_id or nested_id
            father_label = father_label or nested_label
        add("father", father_id, father_label)

        parent_id = value.get("parent_subject_id") or value.get("parent_id")
        parent_label = value.get("parent_label") or value.get("parent_name")
        if parent_id or parent_label:
            role = str(value.get("role") or "parent").casefold()
            kind = "mother" if "mother" in role else "father" if "father" in role else "parent"
            add(kind, parent_id, parent_label)

    twin_id = value.get("twin_id") or value.get("twin_subject_id") or value.get("sibling_id") or value.get("sibling_subject_id")
    twin_label = (
        value.get("twin_name")
        or value.get("sibling_label")
        or value.get("sibling_name")
        or value.get("same_litter_name")
        or value.get("same_birth_date_name")
    )
    if value.get("twin") is not None:
        nested_id, nested_label = nested(value.get("twin"))
        twin_id = twin_id or nested_id
        twin_label = twin_label or nested_label
    if value.get("littermate") is not None:
        nested_id, nested_label = nested(value.get("littermate"))
        twin_id = twin_id or nested_id
        twin_label = twin_label or nested_label
    add("sibling", twin_id, twin_label)

    offspring_id = value.get("offspring_id") or value.get("offspring_subject_id") or value.get("child_id")
    offspring_label = value.get("offspring_label") or value.get("offspring_name") or value.get("child_name")
    add("child", offspring_id, offspring_label)

    for key in ("offspring_ids", "offspring_subject_ids", "cub_ids", "children_ids"):
        children = value.get(key)
        if isinstance(children, list):
            for child in children:
                child_id, child_label = nested(child)
                add("child", child_id, child_label)

    offspring = value.get("offspring")
    if isinstance(offspring, list):
        for child in offspring:
            child_id, child_label = nested(child)
            if isinstance(child, dict):
                child_id = child.get("id") or child.get("subject_id") or child_id
                child_label = child.get("name") or child.get("label") or child_label
            add("child", child_id, child_label)
    elif isinstance(offspring, str):
        add("child", offspring, None)

    return targets


def _normalise_relation_lookup(value: str) -> str:
    return re.sub(r"[\s·・._'’\"-]+", "", value.casefold()).strip()


def _row_confirms_subject_death(row: dict[str, Any]) -> bool:
    if str(row.get("category") or "").casefold() != "death":
        return False
    predicate = str(row.get("predicate") or "").casefold()
    if re.search(r"cub_loss|offspring|litter", predicate):
        return False
    return bool(re.search(r"(?:^|_)(?:death|deceased|stillborn)(?:_|$)|cause_of_death", predicate))


def _reverse_relation_kind(kind: str) -> str | None:
    if kind in {"mother", "father", "parent"}:
        return "child"
    if kind == "child":
        return "parent"
    if kind in {"sibling", "twin"}:
        return "sibling"
    return None


def _record_summary(row: dict[str, Any]) -> tuple[str | None, str | None]:
    zh = row.get("summary_zh")
    en = row.get("summary_en")
    return (
        str(zh).strip() if isinstance(zh, str) and zh.strip() else None,
        str(en).strip() if isinstance(en, str) and en.strip() else None,
    )


def _normalise_public_summary(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None

    # Preserve the factual sentence after common acquisition/editorial lead-ins.
    text = re.sub(r"^补(?:齐|充)?[^：:]{0,32}[：:]\s*", "", text)
    text = re.sub(r"^(?:新增|直接整理|强来源补充)[^：:]{0,52}[：:]\s*", "", text)
    text = re.sub(r"^把[^：:]{0,48}汇总成可查询繁殖范围[：:]\s*", "", text)

    # These clauses describe curation decisions rather than the panda itself.
    text = re.sub(r"[；;]不把野培状态误写成已放归。?$", "。", text)
    text = re.sub(r"[；;]不修改生物学母亲。?$", "。", text)
    text = re.sub(r"[；;]不从[^；;。]+(?:推断|反推|猜)[^。]*。?$", "。", text)

    blocked_markers = (
        "本轮",
        "本批",
        "本次采集",
        "补充确认",
        "补入",
        "专题确认",
        "回归确认",
        "canonical",
        "round",
        "batch",
        "subject",
        "事实层",
        "媒体发现层",
        "采集层",
        "显式把",
        "解析到现有",
        "接回既有",
        "旧批次",
        "已完成外部媒体审计",
        "未发现可安全映射",
        "supporting media",
        "可查询繁殖范围",
    )
    lowered = text.casefold()
    if any(marker.casefold() in lowered for marker in blocked_markers):
        return None
    if text.startswith(("新增", "补齐", "补录", "补入", "直接整理", "接回", "复用")):
        return None
    public_prefixes = (
        "近况资料描述",
        "近况资料记录",
        "专题称",
        "来源称",
        "资料显示",
        "资料记录",
    )
    for prefix in public_prefixes:
        if text.startswith(prefix):
            text = text[len(prefix):].lstrip("，,：: ")
            break
    nickname_match = re.fullmatch(r"(.+?)，获得(.+?)昵称。?", text)
    if nickname_match:
        text = f"{nickname_match.group(1)}，因此有了“{nickname_match.group(2)}”的昵称。"
    return text or None


def _public_fact_item(row: dict[str, Any]) -> dict[str, Any] | None:
    predicate = str(row.get("predicate") or "").casefold()
    if predicate in HIGHLIGHT_EXCLUDED_PREDICATES:
        return None
    category = str(row.get("category") or "").casefold()
    if category in {"name", "sex", "birth", "origin", "conflict"}:
        return None
    zh, en = _record_summary(row)
    zh = _normalise_public_summary(zh)
    en = _normalise_public_summary(en)
    if not zh and not en:
        return None
    return {
        "id": str(row.get("record_id") or ""),
        "category": category,
        "predicate": str(row.get("predicate") or ""),
        "date": _record_date(row),
        "summary_zh": zh,
        "summary_en": en,
        "source_id": row.get("source_id"),
    }


def _classification_evidence_item(row: dict[str, Any]) -> dict[str, str] | None:
    category = str(row.get("category") or "").casefold()
    predicate = str(row.get("predicate") or "")
    if category not in CLASSIFICATION_CATEGORIES and not CLASSIFICATION_PREDICATE_RE.search(predicate):
        return None
    record_id = str(row.get("record_id") or "").strip()
    if not record_id or not predicate:
        return None
    # This is non-display metadata: source prose and values stay out of the projection.
    return {"id": record_id, "category": category, "predicate": predicate}


def _media_item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("media_id") or row.get("asset_url") or ""),
        "url": str(row.get("asset_url") or ""),
        "credit": row.get("credit"),
        "rights": row.get("rights_label") or row.get("rights_state"),
        "source_url": row.get("source_page_url"),
        "captured_at": row.get("captured_at"),
        "description": row.get("description"),
    }


def _source_item(source: dict[str, Any], family: str | None) -> dict[str, Any]:
    return {
        "id": str(source.get("source_id") or ""),
        "publisher": str(source.get("publisher") or ""),
        "title": str(source.get("title") or ""),
        "url": str(source.get("url") or ""),
        "source_type": source.get("source_type"),
        "authority": source.get("authority"),
        "source_family": family,
        "retrieved_at": source.get("retrieved_at"),
    }


def build_details(catalog: dict[str, Any]) -> dict[str, Any]:
    records, sources, media = _load_vault()
    catalog_rows = [row for row in catalog.get("pandas", []) if isinstance(row, dict)]
    catalog_by_id = {str(row.get("id")): row for row in catalog_rows if row.get("id")}
    aliases = {
        **_canonical_subject_aliases(records),
        **_identity_merge_aliases(catalog_rows),
    }
    superseded = _superseded_bounded_subject_ids(records)
    canonical_catalog_ids = {
        _canonical_subject_id(subject_id, aliases): subject_id for subject_id in catalog_by_id
    }
    catalog_name_index: dict[str, set[str]] = defaultdict(set)
    for catalog_id, catalog_row in catalog_by_id.items():
        canonical_id = _canonical_subject_id(catalog_id, aliases)
        for key in ("name_zh", "name_en"):
            value = catalog_row.get(key)
            if isinstance(value, str) and value.strip():
                catalog_name_index[_normalise_relation_lookup(value)].add(canonical_id)
        label = catalog_row.get("label")
        if isinstance(label, str) and label.strip():
            for part in re.split(r"[/（(]", label):
                candidate = part.strip()
                if candidate:
                    catalog_name_index[_normalise_relation_lookup(candidate)].add(canonical_id)

    source_by_id = {
        str(source.get("source_id")): source
        for source in sources
        if isinstance(source, dict) and source.get("source_id")
    }
    source_family = _source_family_map(sources)

    safe_by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)
    labels: dict[str, str] = {}
    for row in records:
        subject = _subject(row)
        if subject is None:
            continue
        raw_id, label = subject
        if raw_id in superseded:
            continue
        subject_id = _canonical_subject_id(raw_id, aliases)
        labels.setdefault(subject_id, label)
        if _review_is_safe(row):
            safe_by_subject[subject_id].append(row)

    media_by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in media:
        raw_id = str(row.get("subject_id") or "")
        if not raw_id or raw_id in superseded or not media_row_is_confirmed_subject_depiction(row):
            continue
        subject_id = _canonical_subject_id(raw_id, aliases)
        if subject_id not in canonical_catalog_ids or not row.get("asset_url"):
            continue
        media_by_subject[subject_id].append(row)

    relations_by_subject: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for subject_id, rows in safe_by_subject.items():
        for row in rows:
            category = str(row.get("category") or "").casefold()
            predicate = str(row.get("predicate") or "")
            if category not in RELATION_CATEGORIES and not any(
                marker in predicate.casefold()
                for marker in ("mother", "father", "parent", "offspring", "child", "sibling", "brother", "sister", "twin")
            ):
                continue
            zh, en = _record_summary(row)
            relation_targets = _relation_targets(row.get("value"), predicate)
            for target_index, (relation_kind, raw_target_id, target_label) in enumerate(relation_targets):
                target_id = raw_target_id
                if target_id:
                    canonical_target_id = _canonical_subject_id(target_id, aliases)
                    if canonical_target_id in canonical_catalog_ids:
                        target_id = canonical_target_id
                    else:
                        if not target_label:
                            target_label = labels.get(canonical_target_id) or target_id
                        target_id = None

                if not target_id and target_label:
                    candidates = catalog_name_index.get(_normalise_relation_lookup(target_label), set())
                    if len(candidates) == 1:
                        target_id = next(iter(candidates))

                if target_id == subject_id:
                    continue

                if not target_label and target_id:
                    target_catalog_id = canonical_catalog_ids.get(target_id)
                    target_catalog = catalog_by_id.get(target_catalog_id or "")
                    target_label = labels.get(target_id)
                    if not target_label and target_catalog:
                        target_label = (
                            target_catalog.get("name_zh")
                            or target_catalog.get("name_en")
                            or target_catalog.get("label")
                        )

                if not target_id and not target_label:
                    continue

                base_relation_id = str(
                    row.get("record_id")
                    or f"{subject_id}:{predicate}:{target_id or target_label}"
                )
                relation = {
                    "id": f"{base_relation_id}:{target_index}",
                    "kind": relation_kind,
                    "target_subject_id": target_id,
                    "target_label": target_label,
                    "summary_zh": zh,
                    "summary_en": en,
                    "source_id": row.get("source_id"),
                }
                relations_by_subject[subject_id].append(relation)

                reverse_kind = _reverse_relation_kind(relation_kind)
                if reverse_kind and target_id:
                    source_catalog_id = canonical_catalog_ids.get(subject_id)
                    source_catalog = catalog_by_id.get(source_catalog_id or "")
                    source_label = labels.get(subject_id)
                    if not source_label and source_catalog:
                        source_label = (
                            source_catalog.get("name_zh")
                            or source_catalog.get("name_en")
                            or source_catalog.get("label")
                        )
                    relations_by_subject[target_id].append(
                        {
                            "id": f"reverse:{relation['id']}",
                            "kind": reverse_kind,
                            "target_subject_id": subject_id,
                            "target_label": source_label,
                            "summary_zh": None,
                            "summary_en": None,
                            "source_id": row.get("source_id"),
                        }
                    )

    subjects: dict[str, dict[str, Any]] = {}
    matched_catalog_subjects = 0
    subjects_with_safe_records = 0
    subjects_with_relations = 0
    subjects_with_timeline = 0
    subjects_with_media = 0

    for catalog_id, catalog_row in catalog_by_id.items():
        subject_id = _canonical_subject_id(catalog_id, aliases)
        rows = safe_by_subject.get(subject_id, [])
        if subject_id in safe_by_subject or subject_id in media_by_subject:
            matched_catalog_subjects += 1
        if rows:
            subjects_with_safe_records += 1

        core = {
            key: value
            for key, predicates in CORE_PREDICATES.items()
            if (value := _unique_core_value(rows, predicates)) is not None
        }
        subject_death_rows = [row for row in rows if _row_confirms_subject_death(row)]
        if subject_death_rows and "life_status" not in core:
            core["life_status"] = "deceased"
        if subject_death_rows and "death_date" not in core:
            death_dates = sorted({date for row in subject_death_rows if (date := _record_date(row))})
            if death_dates:
                core["death_date"] = death_dates[0]

        moments: list[dict[str, Any]] = []
        for row in rows:
            date = _record_date(row)
            if not date:
                continue
            category = str(row.get("category") or "").casefold()
            if category not in TIMELINE_CATEGORIES:
                continue
            zh, en = _record_summary(row)
            if not zh and not en:
                continue
            moments.append(
                {
                    "id": str(row.get("record_id") or ""),
                    "date": date,
                    "category": category,
                    "predicate": str(row.get("predicate") or ""),
                    "summary_zh": zh,
                    "summary_en": en,
                    "source_id": row.get("source_id"),
                }
            )
        moments.sort(key=lambda item: (item["date"], item["id"]))
        if moments:
            subjects_with_timeline += 1

        highlight_rows: list[tuple[int, str, dict[str, Any]]] = []
        seen_highlights: set[str] = set()
        for row in rows:
            predicate = str(row.get("predicate") or "").casefold()
            category = str(row.get("category") or "").casefold()
            if predicate in HIGHLIGHT_EXCLUDED_PREDICATES:
                continue
            zh, en = _record_summary(row)
            identity = zh or en
            if not identity or identity in seen_highlights:
                continue
            if category not in HIGHLIGHT_CATEGORY_PRIORITY and category in {"name", "sex", "birth", "origin"}:
                continue
            seen_highlights.add(identity)
            highlight_rows.append(
                (
                    HIGHLIGHT_CATEGORY_PRIORITY.get(category, 50),
                    str(row.get("record_id") or ""),
                    {
                        "id": str(row.get("record_id") or ""),
                        "category": category,
                        "predicate": str(row.get("predicate") or ""),
                        "summary_zh": zh,
                        "summary_en": en,
                        "source_id": row.get("source_id"),
                    },
                )
            )
        highlight_rows.sort(key=lambda item: (item[0], item[1]))
        highlights = [item[2] for item in highlight_rows[:16]]

        fact_rows: list[tuple[int, str, dict[str, Any]]] = []
        seen_facts: set[str] = set()
        for row in rows:
            fact = _public_fact_item(row)
            if fact is None:
                continue
            identity = str(fact.get("summary_zh") or fact.get("summary_en") or "").strip()
            if not identity or identity in seen_facts:
                continue
            seen_facts.add(identity)
            fact_rows.append(
                (
                    HIGHLIGHT_CATEGORY_PRIORITY.get(str(fact.get("category") or ""), 50),
                    str(fact.get("date") or "9999-99-99") + ":" + str(fact.get("id") or ""),
                    fact,
                )
            )
        fact_rows.sort(key=lambda item: (item[0], item[1]))
        facts = [item[2] for item in fact_rows[:80]]

        classification_evidence: list[dict[str, str]] = []
        classification_seen: set[str] = set()
        for row in rows:
            item = _classification_evidence_item(row)
            if item is None or item["id"] in classification_seen:
                continue
            classification_seen.add(item["id"])
            classification_evidence.append(item)

        relation_seen: set[tuple[str, str, str]] = set()
        relations: list[dict[str, Any]] = []
        for relation in relations_by_subject.get(subject_id, []):
            target_id = str(relation.get("target_subject_id") or "")
            target_label = str(relation.get("target_label") or "")
            key = (str(relation.get("kind") or ""), target_id, target_label)
            if key in relation_seen:
                continue
            relation_seen.add(key)
            target_catalog_id = canonical_catalog_ids.get(target_id)
            target_catalog = catalog_by_id.get(target_catalog_id or "")
            relations.append(
                {
                    **relation,
                    "target_slug": target_catalog.get("slug") if target_catalog else None,
                    "target_name_zh": target_catalog.get("name_zh") if target_catalog else None,
                    "target_name_en": target_catalog.get("name_en") if target_catalog else None,
                }
            )
        relations.sort(key=lambda item: (str(item.get("kind") or ""), str(item.get("target_label") or "")))
        if relations:
            subjects_with_relations += 1

        media_items: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        for media_row in sorted(
            media_by_subject.get(subject_id, []),
            key=lambda row: (
                str(row.get("captured_at") or "9999"),
                int(row.get("collection_priority") or 99),
                str(row.get("media_id") or ""),
            ),
        ):
            url = str(media_row.get("asset_url") or "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            media_items.append(_media_item(media_row))
            if len(media_items) >= 12:
                break
        if media_items:
            subjects_with_media += 1

        source_ids = {
            str(row.get("source_id"))
            for row in rows
            if row.get("source_id")
        }
        source_ids.update(
            str(relation.get("source_id"))
            for relation in relations
            if relation.get("source_id")
        )
        source_items = [
            _source_item(source_by_id[source_id], source_family.get(source_id))
            for source_id in sorted(source_ids)
            if source_id in source_by_id
            and source_by_id[source_id].get("url")
            and source_by_id[source_id].get("title")
        ]

        subjects[catalog_id] = {
            "id": catalog_id,
            "canonical_research_id": subject_id,
            "slug": catalog_row.get("slug"),
            "label": catalog_row.get("label") or labels.get(subject_id),
            "core": core,
            "relations": relations,
            "moments": moments[:60],
            "highlights": highlights,
            "facts": facts,
            "classification_evidence": classification_evidence,
            "media": media_items,
            "sources": source_items,
        }

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "fan-v08 research detail projection",
        "summary": {
            "catalog_subject_count": len(catalog_by_id),
            "matched_catalog_subject_count": matched_catalog_subjects,
            "subjects_with_safe_direct_records": subjects_with_safe_records,
            "subjects_with_relations": subjects_with_relations,
            "subjects_with_timeline": subjects_with_timeline,
            "subjects_with_confirmed_media": subjects_with_media,
        },
        "subjects": subjects,
    }


def main() -> None:
    args = parse_args()
    catalog = _load_catalog(args.catalog)
    details = build_details(catalog)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            details,
            ensure_ascii=False,
            indent=2 if args.pretty else None,
            separators=None if args.pretty else (",", ":"),
        ),
        encoding="utf-8",
    )
    summary = details["summary"]
    print(
        "FAN_V08_RESEARCH_DETAILS",
        *(f"{key}={value}" for key, value in summary.items()),
        f"output={args.output}",
    )


if __name__ == "__main__":
    main()
