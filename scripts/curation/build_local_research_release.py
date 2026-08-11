from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import sys
import tempfile
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]
API_ROOT = REPO_ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.projection.public_release import PublicReleaseInput, build_public_release  # noqa: E402

BASE_VERSION = "2026.07.31.1"
RELEASE_VERSION = "2026.08.12.1"
PUBLICATION_BATCH_ID = "local-research-direct-merge-2026-08-12"
PROJECTION_CODE_VERSION = "local-research-merge-v1"
DATABASE_MIGRATION_VERSION = "0007"
DEFAULT_RELEASED_AT = datetime(2026, 8, 12, 0, 0, tzinfo=UTC)
LOCAL_RESEARCH_ROOT = REPO_ROOT / "data" / "local-panda-research"
REVIEWED_ROOT = REPO_ROOT / "data" / "reviewed-batches"
PUBLIC_ROOT = REPO_ROOT / "data" / "public-releases"

NAME_PREDICATES = {
    "official_current_name_form",
    "official_name",
    "official_chinese_name_form",
    "official_chinese_name_variant",
    "pandapia_chinese_name_variant",
    "official_romanised_name_form",
    "documented_name_form",
    "canonical_name",
    "english_name",
    "chinese_name",
    "name",
    "alias",
    "aliases",
    "canonical_aliases",
    "normalized_aliases",
}
DATE_PATTERN = re.compile(r"^(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})$")
CJK_PATTERN = re.compile(r"[\u3400-\u9fff]")
SLUG_PATTERN = re.compile(r"[^a-z0-9]+")
PAREN_SUFFIX_PATTERN = re.compile(r"\s*[（(][^()（）]*[）)]\s*$")


@dataclass(frozen=True)
class MergeResult:
    source_state: dict[str, Any]
    subject_id_map: dict[str, str]
    report: dict[str, Any]


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    return re.sub(r"[\s\-‐‑‒–—_/.,'’()（）\[\]{}:：·]+", "", value)


def stable_hash(value: str, length: int = 16) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def stable_panda_id(subject_id: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/pandas/local-research/{subject_id}"))


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = SLUG_PATTERN.sub("-", normalized.casefold()).strip("-")
    return slug or f"panda-{stable_hash(value, 10)}"


def _language(value: str) -> str:
    return "zh-Hans" if CJK_PATTERN.search(value) else "en"


def _strip_disambiguator(value: str) -> str:
    return PAREN_SUFFIX_PATTERN.sub("", value).strip()


def _string_values(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        if value.strip():
            yield value.strip()
    elif isinstance(value, list):
        for item in value:
            yield from _string_values(item)
    elif isinstance(value, dict):
        for key in (
            "name",
            "label",
            "value",
            "alias",
            "aliases",
            "en",
            "zh",
            "chinese_name",
            "english_name",
            "named_subject",
            "official_name",
        ):
            if key in value:
                yield from _string_values(value[key])


def _label_names(label: str) -> list[str]:
    candidates: list[str] = []
    for part in re.split(r"[/|｜]", label):
        candidate = _strip_disambiguator(part.strip())
        if candidate:
            candidates.append(candidate)
    return list(dict.fromkeys(candidates))


def _record_subject(record: dict[str, Any]) -> tuple[str, str] | None:
    subject = record.get("subject")
    if not isinstance(subject, dict) or subject.get("type") != "panda" or not subject.get("id"):
        return None
    return str(subject["id"]), str(subject.get("label") or subject["id"])


def _subject_names(records: list[dict[str, Any]]) -> dict[str, list[str]]:
    names: dict[str, list[str]] = defaultdict(list)
    for record in records:
        subject = _record_subject(record)
        if subject is None:
            continue
        subject_id, label = subject
        names[subject_id].extend(_label_names(label))
        predicate = str(record.get("predicate") or "")
        if predicate in NAME_PREDICATES:
            names[subject_id].extend(_string_values(record.get("value")))
        value = record.get("value")
        if isinstance(value, dict):
            for key in ("named_subject", "chinese_name", "english_name", "official_name"):
                names[subject_id].extend(_string_values(value.get(key)))
    for subject_id, values in names.items():
        unique: list[str] = []
        seen: set[str] = set()
        for value in values:
            candidate = _strip_disambiguator(str(value).strip())
            normalized = normalize_name(candidate)
            if normalized and normalized not in seen:
                seen.add(normalized)
                unique.append(candidate)
        names[subject_id] = unique or [subject_id]
    return dict(names)


def _formal_names(record: dict[str, Any]) -> list[str]:
    public = record.get("public", {})
    values = [str(public.get("canonical_slug") or "")]
    for collection in ("names", "aliases"):
        for item in public.get(collection, []):
            if isinstance(item, dict) and item.get("value"):
                values.append(str(item["value"]))
    return [value for value in values if value]


def _identity_mapping(
    base: dict[str, Any], subject_names: dict[str, list[str]]
) -> tuple[dict[str, str], dict[str, str], list[str]]:
    formal_records: list[tuple[str, dict[str, Any], str]] = []
    formal_records.extend((str(item["id"]), item, "pandas") for item in base.get("pandas", []))
    formal_records.extend(
        (str(item["id"]), item, "related_pandas") for item in base.get("related_pandas", [])
    )
    formal_name_index: dict[str, set[str]] = defaultdict(set)
    formal_slugs: dict[str, str] = {}
    formal_kind: dict[str, str] = {}
    for panda_id, record, kind in formal_records:
        formal_kind[panda_id] = kind
        slug = str(record.get("public", {}).get("canonical_slug") or "")
        if slug:
            formal_slugs[normalize_name(slug)] = panda_id
        for name in _formal_names(record):
            normalized = normalize_name(name)
            if normalized:
                formal_name_index[normalized].add(panda_id)

    local_name_index: dict[str, set[str]] = defaultdict(set)
    for subject_id, values in subject_names.items():
        for value in values:
            normalized = normalize_name(value)
            if normalized:
                local_name_index[normalized].add(subject_id)

    mapping: dict[str, str] = {}
    promoted_related: dict[str, str] = {}
    ambiguous: list[str] = []
    for subject_id in sorted(subject_names):
        normalized_subject = normalize_name(subject_id)
        strong = formal_slugs.get(normalized_subject)
        if strong:
            mapping[subject_id] = strong
            if formal_kind.get(strong) == "related_pandas":
                promoted_related[subject_id] = strong
            continue

        candidates: set[str] = set()
        saw_ambiguous_key = False
        for value in subject_names[subject_id]:
            key = normalize_name(value)
            local_ids = local_name_index.get(key, set())
            formal_ids = formal_name_index.get(key, set())
            if len(local_ids) == 1 and len(formal_ids) == 1:
                candidates.update(formal_ids)
            elif formal_ids:
                saw_ambiguous_key = True
        if len(candidates) == 1:
            panda_id = next(iter(candidates))
            mapping[subject_id] = panda_id
            if formal_kind.get(panda_id) == "related_pandas":
                promoted_related[subject_id] = panda_id
        else:
            if len(candidates) > 1 or saw_ambiguous_key:
                ambiguous.append(subject_id)
            mapping[subject_id] = stable_panda_id(subject_id)
    return mapping, promoted_related, ambiguous


def _source_ids_for_subject(records: list[dict[str, Any]], subject_id: str) -> list[str]:
    return sorted(
        {
            str(record["source_id"])
            for record in records
            if _record_subject(record)
            and _record_subject(record)[0] == subject_id
            and record.get("source_id")
        }
    )


def _sex_value(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = unicodedata.normalize("NFKC", value).casefold().strip()
    if normalized in {"male", "m", "雄", "雄性", "公"}:
        return "male"
    if normalized in {"female", "f", "雌", "雌性", "母"}:
        return "female"
    if normalized in {"unknown", "未知", "不详"}:
        return "unknown"
    return None


def _extract_values(record: dict[str, Any], canonical_field: str) -> list[Any]:
    predicate = str(record.get("predicate") or "").casefold()
    value = record.get("value")
    values: list[Any] = []
    predicate_aliases = {
        "birth_date": {"birth_date", "birth_datetime"},
        "death_date": {"death_date", "death_datetime"},
        "birthplace": {"birthplace", "birth_place", "birth_location"},
        "sex": {"sex", "gender"},
        "life_status": {"life_status", "living_status"},
    }
    if predicate in predicate_aliases.get(canonical_field, set()):
        values.append(value)
    if isinstance(value, dict):
        key_aliases = {
            "birth_date": ("birth_date", "date_of_birth"),
            "death_date": ("death_date", "date_of_death"),
            "birthplace": ("birthplace", "birth_place", "birth_location"),
            "sex": ("sex", "gender"),
            "life_status": ("life_status", "living_status"),
        }
        for key in key_aliases.get(canonical_field, ()):
            if key in value:
                values.append(value[key])
    return values


def _full_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    candidate = value.strip()[:10]
    return candidate if DATE_PATTERN.fullmatch(candidate) else None


def _consensus(
    records: list[dict[str, Any]], subject_id: str, canonical_field: str
) -> tuple[Any | None, set[str]]:
    values: list[Any] = []
    for record in records:
        subject = _record_subject(record)
        if subject is None or subject[0] != subject_id:
            continue
        for value in _extract_values(record, canonical_field):
            if canonical_field in {"birth_date", "death_date"}:
                normalized = _full_date(value)
            elif canonical_field == "sex":
                normalized = _sex_value(value)
            elif isinstance(value, str):
                normalized = value.strip() or None
            else:
                normalized = None
            if normalized is not None:
                values.append(normalized)
    distinct = {str(value) for value in values}
    if len(distinct) == 1:
        return values[0], distinct
    return None, distinct


def _explicit_life_status(records: list[dict[str, Any]], subject_id: str) -> tuple[str, bool]:
    statuses: set[str] = set()
    for record in records:
        subject = _record_subject(record)
        if subject is None or subject[0] != subject_id:
            continue
        for value in _extract_values(record, "life_status"):
            if not isinstance(value, str):
                continue
            normalized = value.casefold().strip()
            if normalized in {"alive", "living", "在世", "存活"}:
                statuses.add("alive")
            elif normalized in {"deceased", "dead", "死亡", "去世"}:
                statuses.add("deceased")
        if _full_date(next(iter(_extract_values(record, "death_date")), None)):
            statuses.add("deceased")
    if len(statuses) == 1:
        return next(iter(statuses)), False
    return "unknown", len(statuses) > 1


def _raw_public_value(value: Any) -> Any:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _fact_status(record: dict[str, Any]) -> str:
    text = " ".join(
        str(record.get(key) or "") for key in ("predicate", "confidence", "evidence_level", "review_status")
    ).casefold()
    if "conflict" in text or "disput" in text or "contradict" in text:
        return "disputed"
    if record.get("evidence_level") == "direct":
        return "confirmed"
    return "provisional"


def _record_date(record: dict[str, Any], released_at: datetime) -> str:
    for key in ("collected_at", "retrieved_at", "published_at"):
        value = record.get(key)
        if isinstance(value, str) and DATE_PATTERN.fullmatch(value[:10]):
            return value[:10]
    return released_at.date().isoformat()


def _source_public(source: dict[str, Any], released_at: datetime) -> dict[str, Any]:
    retrieved = str(source.get("retrieved_at") or "")
    last_verified_at = retrieved[:10] if DATE_PATTERN.fullmatch(retrieved[:10]) else released_at.date().isoformat()
    published = str(source.get("published_at") or source.get("publication_date") or "")
    public: dict[str, Any] = {
        "publisher": str(source.get("publisher") or "Unknown publisher"),
        "title": str(source.get("title") or source.get("source_id") or "Untitled source"),
        "url": str(source.get("url") or f"local://{source.get('source_id', 'unknown')}"),
        "published_at": published[:10] if DATE_PATTERN.fullmatch(published[:10]) else None,
        "last_verified_at": last_verified_at,
        "language": str(source.get("language") or "und"),
        "access_state": "accessible" if source.get("url") else "local_reference",
    }
    authority = str(source.get("authority") or "").casefold()
    if authority:
        public["evidence_tier"] = "primary" if "primary" in authority else "secondary"
    return public


def make_panda_record(
    *,
    panda_id: str,
    slug: str,
    names: list[tuple[str, str]],
    source_ids: list[str],
    sex: str,
    life_status: str,
) -> dict[str, Any]:
    primary_seen: set[str] = set()
    structured_names: list[dict[str, Any]] = []
    aliases: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for language, value in names:
        key = (language, normalize_name(value))
        if not key[1] or key in seen:
            continue
        seen.add(key)
        item = {
            "kind": "official" if language == "zh-Hans" else "official_romanization",
            "language": language,
            "primary": language not in primary_seen,
            "source_ids": source_ids,
            "value": value,
        }
        if item["primary"]:
            primary_seen.add(language)
            structured_names.append(item)
        else:
            item["primary"] = False
            item["kind"] = "alias"
            aliases.append(item)
    if not structured_names:
        structured_names.append(
            {
                "kind": "official_romanization",
                "language": "en",
                "primary": True,
                "source_ids": source_ids,
                "value": slug,
            }
        )
    return {
        "id": panda_id,
        "publication_status": "published",
        "public": {
            "aliases": aliases,
            "canonical_slug": slug,
            "content": [],
            "external_identifiers": [],
            "legacy_slugs": [],
            "life_status": life_status,
            "names": structured_names,
            "record_tier": "identity_first_pass",
            "revision_summaries": [],
            "sex": sex,
        },
        "restricted": {
            "curator_notes": "Directly merged from the local research vault without a human publication review step."
        },
    }


def _augment_existing_identity(
    panda: dict[str, Any], names: list[str], source_ids: list[str], sex: str | None, life_status: str
) -> None:
    public = panda.setdefault("public", {})
    existing = {
        normalize_name(str(item.get("value") or ""))
        for collection in ("names", "aliases")
        for item in public.get(collection, [])
        if isinstance(item, dict)
    }
    for value in names:
        normalized = normalize_name(value)
        if not normalized or normalized in existing:
            continue
        public.setdefault("aliases", []).append(
            {
                "kind": "local_research_alias",
                "language": _language(value),
                "primary": False,
                "source_ids": source_ids,
                "value": value,
            }
        )
        existing.add(normalized)
    if public.get("sex", "unknown") == "unknown" and sex in {"male", "female"}:
        public["sex"] = sex
    if public.get("life_status", "unknown") == "unknown" and life_status in {"alive", "deceased"}:
        public["life_status"] = life_status


def _promote_related(
    base: dict[str, Any], panda_id: str, subject_names: list[str], source_ids: list[str], sex: str, life_status: str
) -> dict[str, Any]:
    related = next(item for item in base.get("related_pandas", []) if str(item["id"]) == panda_id)
    base["related_pandas"] = [item for item in base.get("related_pandas", []) if str(item["id"]) != panda_id]
    slug = str(related.get("public", {}).get("canonical_slug") or slugify(subject_names[0]))
    record = make_panda_record(
        panda_id=panda_id,
        slug=slug,
        names=[(_language(value), value) for value in subject_names],
        source_ids=source_ids,
        sex=sex,
        life_status=life_status,
    )
    record["restricted"]["promoted_from_dependency_stub"] = True
    base.setdefault("pandas", []).append(record)
    return record


def _unique_slug(subject_id: str, used: set[str]) -> str:
    base_slug = slugify(subject_id)
    slug = base_slug
    if slug in used:
        slug = f"{base_slug}-{stable_hash(subject_id, 8)}"
    used.add(slug)
    return slug


def _parent_reference(record: dict[str, Any], role: str) -> str | None:
    predicate = str(record.get("predicate") or "").casefold()
    value = record.get("value")
    if predicate == role and isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        candidate = value.get(role)
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return None


def _panda_reference_index(
    source_state: dict[str, Any],
    subject_names: dict[str, list[str]],
    subject_id_map: dict[str, str],
) -> dict[str, set[str]]:
    index: dict[str, set[str]] = defaultdict(set)
    for panda in source_state.get("pandas", []):
        panda_id = str(panda["id"])
        for value in _formal_names(panda):
            normalized = normalize_name(value)
            if normalized:
                index[normalized].add(panda_id)
    for subject_id, values in subject_names.items():
        panda_id = subject_id_map[subject_id]
        index[normalize_name(subject_id)].add(panda_id)
        for value in values:
            normalized = normalize_name(value)
            if normalized:
                index[normalized].add(panda_id)
    return index


def _resolve_panda_reference(reference: str, index: dict[str, set[str]]) -> str | None:
    candidates: set[str] = set()
    variants = [reference, *_label_names(reference)]
    for variant in variants:
        normalized = normalize_name(variant)
        if normalized:
            candidates.update(index.get(normalized, set()))
    return next(iter(candidates)) if len(candidates) == 1 else None


def _existing_fact_values(base: dict[str, Any], panda_id: str, field: str) -> set[str]:
    return {
        str(item.get("public", {}).get("value"))
        for item in base.get("facts", [])
        if item.get("publication_status") == "published"
        and item.get("public", {}).get("subject_id") == panda_id
        and item.get("public", {}).get("field") == field
        and item.get("public", {}).get("value") is not None
    }


def _canonical_fact(
    *, panda_id: str, field: str, value: Any, source_ids: list[str], verified_at: str
) -> dict[str, Any]:
    return {
        "id": f"fact-local-canonical-{stable_hash(f'{panda_id}:{field}:{value}', 20)}",
        "publication_status": "published",
        "public": {
            "subject_id": panda_id,
            "field": field,
            "value": value,
            "conclusion_status": "confirmed",
            "source_ids": source_ids,
            "last_verified_at": verified_at,
        },
        "restricted": {"derived_from_local_research_consensus": True},
    }


def _raw_fact(record: dict[str, Any], panda_id: str, released_at: datetime) -> dict[str, Any]:
    record_id = str(record.get("record_id") or f"anonymous-{stable_hash(json.dumps(record, sort_keys=True, default=str), 20)}")
    source_id = str(record.get("source_id") or "")
    predicate = str(record.get("predicate") or "unknown")
    return {
        "id": f"fact-local-{stable_hash(record_id, 24)}",
        "publication_status": "published",
        "public": {
            "subject_id": panda_id,
            "field": f"local:{predicate}",
            "value": _raw_public_value(record.get("value")),
            "conclusion_status": _fact_status(record),
            "source_ids": [source_id] if source_id else [],
            "last_verified_at": _record_date(record, released_at),
        },
        "restricted": {
            "local_record_id": record_id,
            "original_category": record.get("category"),
            "original_predicate": predicate,
            "original_value": record.get("value"),
            "original_summary_zh": record.get("summary_zh"),
            "source_locator": record.get("source_locator"),
            "evidence_level": record.get("evidence_level"),
            "confidence": record.get("confidence"),
            "review_status": record.get("review_status"),
            "original_publication_status": record.get("publication_status"),
            "source_file": record.get("_source_file"),
        },
    }


def _data_quality(
    subject_id: str,
    subject_records: list[dict[str, Any]],
    sources_by_id: dict[str, dict[str, Any]],
    conflict: bool,
) -> str:
    if conflict:
        return "uncertain"
    direct = [record for record in subject_records if record.get("evidence_level") == "direct"]
    primary = any(
        "primary" in str(sources_by_id.get(str(record.get("source_id")), {}).get("authority") or "").casefold()
        for record in direct
    )
    if direct and primary:
        return "verified"
    if direct:
        return "likely"
    return "uncertain"


def _deduplicate_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    duplicates = 0
    for record in records:
        record_id = str(record.get("record_id") or "")
        key = record_id or stable_hash(json.dumps(record, ensure_ascii=False, sort_keys=True, default=str), 32)
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        unique.append(record)
    return unique, duplicates


def _deduplicate_sources(sources: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    by_id: dict[str, dict[str, Any]] = {}
    duplicates = 0
    for source in sources:
        source_id = str(source.get("source_id") or "")
        if not source_id:
            continue
        if source_id in by_id:
            duplicates += 1
            current = by_id[source_id]
            for key, value in source.items():
                if key not in current or current[key] in (None, "", [], {}):
                    current[key] = value
        else:
            by_id[source_id] = dict(source)
    return [by_id[key] for key in sorted(by_id)], duplicates


def merge_local_research(
    base_source: dict[str, Any],
    records: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    *,
    release_version: str,
    released_at: datetime,
) -> MergeResult:
    result = copy.deepcopy(base_source)
    records, duplicate_record_ids = _deduplicate_records(records)
    sources, duplicate_source_ids = _deduplicate_sources(sources)
    panda_records = [record for record in records if _record_subject(record) is not None]
    skipped_non_panda_records = len(records) - len(panda_records)
    subject_names = _subject_names(panda_records)
    subject_id_map, promoted_related, ambiguous_subjects = _identity_mapping(result, subject_names)
    sources_by_id = {str(source["source_id"]): source for source in sources}

    existing_source_ids = {str(item["id"]) for item in result.get("sources", [])}
    for source in sources:
        source_id = str(source["source_id"])
        if source_id in existing_source_ids:
            continue
        result.setdefault("sources", []).append(
            {
                "id": source_id,
                "publication_status": "published",
                "public": _source_public(source, released_at),
                "restricted": {
                    "local_source_metadata": {
                        key: value
                        for key, value in source.items()
                        if key not in {"publisher", "title", "url", "language", "published_at", "publication_date", "retrieved_at"}
                    }
                },
            }
        )
        existing_source_ids.add(source_id)

    used_slugs = {
        str(item.get("public", {}).get("canonical_slug") or "")
        for item in result.get("pandas", []) + result.get("related_pandas", [])
    }
    pandas_by_id = {str(item["id"]): item for item in result.get("pandas", [])}
    new_subjects: list[str] = []
    promoted_subjects: list[str] = []
    sex_conflicts: list[str] = []
    life_status_conflicts: list[str] = []
    birth_conflicts: list[str] = []
    death_conflicts: list[str] = []
    birthplace_conflicts: list[str] = []

    for subject_id in sorted(subject_names):
        panda_id = subject_id_map[subject_id]
        subject_source_ids = [sid for sid in _source_ids_for_subject(panda_records, subject_id) if sid in existing_source_ids]
        sex, sex_values = _consensus(panda_records, subject_id, "sex")
        if len(sex_values) > 1:
            sex_conflicts.append(subject_id)
        life_status, life_conflict = _explicit_life_status(panda_records, subject_id)
        if life_conflict:
            life_status_conflicts.append(subject_id)
        existing_panda = pandas_by_id.get(panda_id)
        if existing_panda is not None:
            existing_public = existing_panda.get("public", {})
            existing_sex = str(existing_public.get("sex") or "unknown")
            if sex in {"male", "female"} and existing_sex in {"male", "female"} and sex != existing_sex:
                sex_conflicts.append(subject_id)
            existing_life_status = str(existing_public.get("life_status") or "unknown")
            if (
                life_status in {"alive", "deceased"}
                and existing_life_status in {"alive", "deceased"}
                and life_status != existing_life_status
            ):
                life_status_conflicts.append(subject_id)
        if subject_id in promoted_related:
            panda = _promote_related(
                result,
                panda_id,
                subject_names[subject_id],
                subject_source_ids,
                str(sex or "unknown"),
                life_status,
            )
            pandas_by_id[panda_id] = panda
            promoted_subjects.append(subject_id)
        elif panda_id in pandas_by_id:
            _augment_existing_identity(
                pandas_by_id[panda_id], subject_names[subject_id], subject_source_ids, sex, life_status
            )
        else:
            slug = _unique_slug(subject_id, used_slugs)
            panda = make_panda_record(
                panda_id=panda_id,
                slug=slug,
                names=[(_language(value), value) for value in subject_names[subject_id]],
                source_ids=subject_source_ids,
                sex=str(sex or "unknown"),
                life_status=life_status,
            )
            result.setdefault("pandas", []).append(panda)
            pandas_by_id[panda_id] = panda
            new_subjects.append(subject_id)
            result.setdefault("media", []).append(
                {
                    "id": f"media-local-none-{stable_hash(panda_id, 20)}",
                    "publication_status": "published",
                    "public": {
                        "panda_id": panda_id,
                        "license_state": "no_licensed_media",
                        "display_mode": "designed_empty_state",
                        "source_ids": [],
                    },
                    "restricted": {
                        "reason": "Local research media was not promoted automatically because publication rights remain per-item."
                    },
                }
            )

    base_fact_ids = {str(item["id"]) for item in result.get("facts", [])}
    for record in panda_records:
        subject_id, _ = _record_subject(record)  # type: ignore[misc]
        fact = _raw_fact(record, subject_id_map[subject_id], released_at)
        if fact["id"] not in base_fact_ids:
            result.setdefault("facts", []).append(fact)
            base_fact_ids.add(fact["id"])

    for subject_id in sorted(subject_names):
        panda_id = subject_id_map[subject_id]
        subject_records = [
            record for record in panda_records if _record_subject(record) and _record_subject(record)[0] == subject_id
        ]
        source_ids = [sid for sid in _source_ids_for_subject(panda_records, subject_id) if sid in existing_source_ids]
        verified_at = max((_record_date(record, released_at) for record in subject_records), default=released_at.date().isoformat())
        conflict = subject_id in sex_conflicts or subject_id in life_status_conflicts
        for field, conflict_list in (
            ("birth_date", birth_conflicts),
            ("death_date", death_conflicts),
            ("birthplace", birthplace_conflicts),
        ):
            value, values = _consensus(panda_records, subject_id, field)
            existing_values = _existing_fact_values(result, panda_id, field)
            if existing_values and values and not values.issubset(existing_values):
                conflict_list.append(subject_id)
                conflict = True
                continue
            if len(values) > 1:
                conflict_list.append(subject_id)
                conflict = True
                continue
            if value is not None and not existing_values:
                fact = _canonical_fact(
                    panda_id=panda_id,
                    field=field,
                    value=value,
                    source_ids=source_ids,
                    verified_at=verified_at,
                )
                if fact["id"] not in base_fact_ids:
                    result.setdefault("facts", []).append(fact)
                    base_fact_ids.add(fact["id"])
                if field == "birth_date":
                    precision = _canonical_fact(
                        panda_id=panda_id,
                        field="birth_date_precision",
                        value="day",
                        source_ids=source_ids,
                        verified_at=verified_at,
                    )
                    if precision["id"] not in base_fact_ids:
                        result["facts"].append(precision)
                        base_fact_ids.add(precision["id"])
        quality = _data_quality(subject_id, subject_records, sources_by_id, conflict)
        quality_fact = _canonical_fact(
            panda_id=panda_id,
            field="data_quality",
            value=quality,
            source_ids=source_ids,
            verified_at=verified_at,
        )
        if quality_fact["id"] not in base_fact_ids:
            result.setdefault("facts", []).append(quality_fact)
            base_fact_ids.add(quality_fact["id"])

    panda_reference_index = _panda_reference_index(result, subject_names, subject_id_map)
    existing_parentage = {
        (
            str(item.get("public", {}).get("child_id")),
            str(item.get("public", {}).get("parent_id")),
            str(item.get("public", {}).get("role")),
        )
        for item in result.get("parentage_assertions", [])
    }
    unresolved_parent_references: list[dict[str, str]] = []
    added_parentage = 0
    for record in panda_records:
        subject_id, _ = _record_subject(record)  # type: ignore[misc]
        for role in ("father", "mother"):
            reference = _parent_reference(record, role)
            if not reference:
                continue
            parent_id = _resolve_panda_reference(reference, panda_reference_index)
            if parent_id is None:
                unresolved_parent_references.append(
                    {"subject_id": subject_id, "role": role, "reference": reference}
                )
                continue
            child_id = subject_id_map[subject_id]
            if child_id == parent_id:
                unresolved_parent_references.append(
                    {"subject_id": subject_id, "role": role, "reference": reference}
                )
                continue
            key = (child_id, parent_id, role)
            if key in existing_parentage:
                continue
            source_id = str(record.get("source_id") or "")
            result.setdefault("parentage_assertions", []).append(
                {
                    "id": f"parentage-local-{stable_hash(':'.join(key), 20)}",
                    "publication_status": "published",
                    "public": {
                        "child_id": child_id,
                        "parent_id": parent_id,
                        "role": role,
                        "status": "confirmed" if record.get("evidence_level") == "direct" else "tentative",
                        "source_ids": [source_id] if source_id in existing_source_ids else [],
                    },
                    "restricted": {
                        "local_record_id": record.get("record_id"),
                        "parent_reference": reference,
                        "direct_merge_without_human_review": True,
                    },
                }
            )
            existing_parentage.add(key)
            added_parentage += 1

    unresolved_parent_references = [
        {"subject_id": subject_id, "role": role, "reference": reference}
        for subject_id, role, reference in sorted(
            {
                (item["subject_id"], item["role"], item["reference"])
                for item in unresolved_parent_references
            }
        )
    ]

    existing_events = {
        (
            str(item.get("public", {}).get("event_type")),
            tuple(sorted(str(value) for value in item.get("public", {}).get("participants", []))),
            str(item.get("public", {}).get("event_date")),
        )
        for item in result.get("events", [])
    }
    added_events = 0
    for subject_id in sorted(subject_names):
        panda_id = subject_id_map[subject_id]
        source_ids = [sid for sid in _source_ids_for_subject(panda_records, subject_id) if sid in existing_source_ids]
        for field, event_type in (("birth_date", "birth"), ("death_date", "death")):
            value, values = _consensus(panda_records, subject_id, field)
            if value is None or len(values) != 1:
                continue
            key = (event_type, (panda_id,), str(value))
            if key in existing_events:
                continue
            result.setdefault("events", []).append(
                {
                    "id": f"event-local-{event_type}-{stable_hash(f'{panda_id}:{value}', 18)}",
                    "publication_status": "published",
                    "public": {
                        "changes_current_residency": False,
                        "event_date": value,
                        "event_date_precision": "day",
                        "event_status": "completed",
                        "event_type": event_type,
                        "participants": [panda_id],
                        "source_ids": source_ids,
                    },
                    "restricted": {"derived_from_local_research_consensus": True},
                }
            )
            existing_events.add(key)
            added_events += 1

    dataset = result["dataset"]
    dataset["base_dataset_version"] = str(base_source["dataset"]["version"])
    dataset["version"] = release_version
    dataset["title"] = f"ZhiPanda direct local research merge {release_version}"
    dataset["core_panda_count"] = len(result.get("pandas", []))
    dataset["expansion_panda_ids"] = sorted(
        set(dataset.get("expansion_panda_ids", []))
        | {subject_id_map[subject_id] for subject_id in new_subjects + promoted_subjects}
    )
    partial = set(dataset.get("partial_profile_panda_ids", []))
    partial.update(subject_id_map[subject_id] for subject_id in new_subjects + promoted_subjects)
    dataset["partial_profile_panda_ids"] = sorted(partial)

    for collection in (
        "events",
        "facilities",
        "facts",
        "institutions",
        "media",
        "pandas",
        "parentage_assertions",
        "places",
        "related_pandas",
        "residencies",
        "sources",
    ):
        result.setdefault(collection, [])
        result[collection].sort(key=lambda item: str(item["id"]))

    report = {
        "release_version": release_version,
        "base_version": str(base_source["dataset"]["version"]),
        "mode": "direct_merge_without_human_review",
        "input": {
            "records": len(records),
            "panda_records": len(panda_records),
            "sources": len(sources),
            "panda_subject_ids": len(subject_names),
            "skipped_non_panda_records": skipped_non_panda_records,
        },
        "identity": {
            "matched_existing_subjects": len(subject_names) - len(new_subjects) - len(promoted_subjects),
            "promoted_dependency_subjects": len(promoted_subjects),
            "new_subjects": len(new_subjects),
            "ambiguous_subject_ids": sorted(ambiguous_subjects),
        },
        "deduplication": {
            "duplicate_record_ids": duplicate_record_ids,
            "duplicate_source_ids": duplicate_source_ids,
        },
        "conflicts": {
            "birth_date_subject_ids": sorted(set(birth_conflicts)),
            "death_date_subject_ids": sorted(set(death_conflicts)),
            "birthplace_subject_ids": sorted(set(birthplace_conflicts)),
            "sex_subject_ids": sorted(set(sex_conflicts)),
            "life_status_subject_ids": sorted(set(life_status_conflicts)),
        },
        "relationships": {
            "added_parentage_assertions": added_parentage,
            "unresolved_parent_reference_count": len(unresolved_parent_references),
            "unresolved_parent_references": unresolved_parent_references,
        },
        "events": {"added_birth_death_events": added_events},
        "output": {
            "pandas": len(result["pandas"]),
            "facts": len(result["facts"]),
            "sources": len(result["sources"]),
            "parentage_assertions": len(result["parentage_assertions"]),
            "events": len(result["events"]),
            "residencies": len(result["residencies"]),
            "media": len(result["media"]),
        },
        "media_policy": (
            "Existing formal media is preserved. Local research media is not auto-published unless it was already in the formal release; "
            "new pandas receive a no_licensed_media state so per-item rights are not bypassed."
        ),
    }
    return MergeResult(source_state=result, subject_id_map=subject_id_map, report=report)


def _iter_jsonl(path: Path) -> Iterable[dict[str, Any]]:
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            yield row


def load_local_research(root: Path = LOCAL_RESEARCH_ROOT) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    sources: list[dict[str, Any]] = []
    master_sources = root / "sources.jsonl"
    if master_sources.is_file():
        sources.extend(_iter_jsonl(master_sources))
    for path in sorted((root / "imports").glob("*.json")):
        try:
            payload = json.loads(path.read_text(encoding="utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        for source in payload.get("sources", []):
            if isinstance(source, dict):
                sources.append(source)
        for record in payload.get("records", []):
            if isinstance(record, dict):
                item = dict(record)
                item["_source_file"] = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
                records.append(item)
    for path in sorted((root / "records").glob("*.jsonl")):
        for record in _iter_jsonl(path):
            item = dict(record)
            item["_source_file"] = str(path.relative_to(REPO_ROOT)).replace("\\", "/")
            records.append(item)
    return records, sources


def build(
    *,
    base_version: str = BASE_VERSION,
    release_version: str = RELEASE_VERSION,
    released_at: datetime = DEFAULT_RELEASED_AT,
    local_root: Path = LOCAL_RESEARCH_ROOT,
) -> tuple[MergeResult, Any]:
    base_path = REVIEWED_ROOT / base_version / "source.json"
    base_source = json.loads(base_path.read_text(encoding="utf-8"))
    records, sources = load_local_research(local_root)
    merged = merge_local_research(
        base_source,
        records,
        sources,
        release_version=release_version,
        released_at=released_at,
    )
    public_release = build_public_release(
        PublicReleaseInput(
            source_state=merged.source_state,
            publication_batch_id=PUBLICATION_BATCH_ID,
            projection_code_version=PROJECTION_CODE_VERSION,
            database_migration_version=DATABASE_MIGRATION_VERSION,
            released_at=released_at,
        )
    )
    return merged, public_release


def _write_outputs(merged: MergeResult, public_release: Any, release_version: str) -> None:
    reviewed_target = REVIEWED_ROOT / release_version
    public_target = PUBLIC_ROOT / release_version
    if reviewed_target.exists() or public_target.exists():
        raise FileExistsError(f"Release target already exists: {release_version}")
    reviewed_target.parent.mkdir(parents=True, exist_ok=True)
    public_target.parent.mkdir(parents=True, exist_ok=True)
    reviewed_staging_root = Path(tempfile.mkdtemp(prefix=".local-research-release-", dir=reviewed_target.parent))
    public_staging_root = Path(tempfile.mkdtemp(prefix=".local-research-release-", dir=public_target.parent))
    staged_reviewed = reviewed_staging_root / release_version
    staged_public = public_staging_root / release_version
    reviewed_installed = False
    try:
        staged_reviewed.mkdir(parents=True)
        (staged_reviewed / "source.json").write_text(
            json.dumps(merged.source_state, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        (staged_reviewed / "merge-report.json").write_text(
            json.dumps(merged.report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        staged_public.mkdir(parents=True)
        for filename, content in public_release.files.items():
            (staged_public / filename).write_text(content, encoding="utf-8", newline="")
        (staged_public / "manifest.json").write_text(
            json.dumps(public_release.manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        shutil.move(str(staged_reviewed), str(reviewed_target))
        reviewed_installed = True
        shutil.move(str(staged_public), str(public_target))
    except Exception:
        if reviewed_installed and reviewed_target.exists() and not public_target.exists():
            shutil.rmtree(reviewed_target)
        raise
    finally:
        shutil.rmtree(reviewed_staging_root, ignore_errors=True)
        shutil.rmtree(public_staging_root, ignore_errors=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Directly merge the local panda research vault into a formal immutable release without a human review gate."
    )
    parser.add_argument("--base-version", default=BASE_VERSION)
    parser.add_argument("--release-version", default=RELEASE_VERSION)
    parser.add_argument("--released-at", default=DEFAULT_RELEASED_AT.isoformat().replace("+00:00", "Z"))
    parser.add_argument("--local-root", type=Path, default=LOCAL_RESEARCH_ROOT)
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    released_at = datetime.fromisoformat(args.released_at.replace("Z", "+00:00"))
    merged, public_release = build(
        base_version=args.base_version,
        release_version=args.release_version,
        released_at=released_at,
        local_root=args.local_root,
    )
    if args.apply:
        _write_outputs(merged, public_release, args.release_version)
    payload = {
        "outcome": "applied" if args.apply else "dry-run",
        "release_version": args.release_version,
        "report": merged.report,
        "manifest_record_counts": public_release.manifest["record_counts"],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
