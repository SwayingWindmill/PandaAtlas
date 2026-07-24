from __future__ import annotations

import csv
import hashlib
import json
import re
from collections.abc import Iterable
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5

COLLECTION_RELEASE_SCHEMA_VERSION = "panda-atlas-collection-release-candidate/v1"
ELIGIBLE_REVIEW_STATUSES = {"reviewed", "approved"}
ELIGIBLE_EVIDENCE_STATUS = "verified"
COLLECTIONS = (
    "sources",
    "facilities",
    "institutions",
    "places",
    "pandas",
    "facts",
    "residencies",
    "events",
    "parentage_assertions",
    "related_pandas",
    "media",
)
_RELEASE_VERSION_PATTERN = re.compile(r"^\d{4}\.\d{2}\.\d{2}\.\d+$")
_CJK_PATTERN = re.compile(r"[\u3400-\u9fff]")


@dataclass(frozen=True)
class CollectionReleaseCandidate:
    source_state: dict[str, Any]
    report: dict[str, Any]

    def source_json(self) -> str:
        return (
            json.dumps(
                self.source_state,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
                allow_nan=False,
            )
            + "\n"
        )

    def report_json(self) -> str:
        return (
            json.dumps(
                self.report,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
                allow_nan=False,
            )
            + "\n"
        )


def build_collection_release_candidate(
    *,
    base_source_state: dict[str, Any],
    curation_dir: Path,
    release_version: str,
    publication_batch_id: str,
    released_at: datetime,
) -> CollectionReleaseCandidate:
    _validate_inputs(
        base_source_state=base_source_state,
        curation_dir=curation_dir,
        release_version=release_version,
        publication_batch_id=publication_batch_id,
        released_at=released_at,
    )
    base_version = str(base_source_state["dataset"]["version"])
    source = deepcopy(base_source_state)
    pandas_rows = _read_csv(curation_dir / "pandas.csv")
    event_rows = _read_csv(curation_dir / "events.csv")
    source_rows = _read_csv(curation_dir / "sources.csv")
    source_rows_by_id = {row["source_id"]: row for row in source_rows}

    existing_pandas_by_slug = {
        str(record["public"]["canonical_slug"]): record for record in source["pandas"]
    }
    panda_ids_by_slug = {
        slug: str(record["id"]) for slug, record in existing_pandas_by_slug.items()
    }
    existing_source_ids = {str(record["id"]) for record in source["sources"]}
    eligible_rows = [row for row in pandas_rows if _eligible_panda(row)]
    eligible_rows.sort(key=lambda row: row["slug"])
    existing_residency_panda_ids = {
        str(record.get("public", {}).get("panda_id")) for record in source["residencies"]
    }

    decisions: list[dict[str, Any]] = []
    included_rows: list[dict[str, str]] = []
    for row in eligible_rows:
        source_ids = _split_ids(row["primary_source_ids"])
        missing_sources = sorted(
            source_id
            for source_id in source_ids
            if source_id not in existing_source_ids and source_id not in source_rows_by_id
        )
        gaps = _profile_gaps(row)
        existing_panda_id = panda_ids_by_slug.get(row["slug"])
        if (
            row["current_location"].strip()
            and existing_panda_id not in existing_residency_panda_ids
            and not _has_reviewed_residency_start(row, event_rows)
        ):
            gaps.append("reviewed_current_residency_start")
        if not row["name_zh"].strip() or not row["name_en"].strip():
            decisions.append(
                _decision(
                    row,
                    action="deferred",
                    risk_tier="blocked",
                    gaps=gaps,
                    reasons=("Both Chinese and English names are required.",),
                )
            )
            continue
        if not source_ids or missing_sources:
            reasons = []
            if not source_ids:
                reasons.append("No primary source IDs are attached to the curation row.")
            if missing_sources:
                reasons.append("Missing source rows: " + ", ".join(missing_sources))
            decisions.append(
                _decision(
                    row,
                    action="deferred",
                    risk_tier="blocked",
                    gaps=gaps,
                    reasons=tuple(reasons),
                )
            )
            continue
        risk_tier = "high" if not gaps else "medium"
        action = "preserve" if row["slug"] in existing_pandas_by_slug else "add"
        decisions.append(
            _decision(
                row,
                action=action,
                risk_tier=risk_tier,
                gaps=gaps,
                reasons=(),
            )
        )
        included_rows.append(row)
        panda_ids_by_slug.setdefault(
            row["slug"],
            str(uuid5(NAMESPACE_URL, f"https://zhipanda.com/pandas/{row['slug']}")),
        )

    risk_tier_by_slug = {
        decision["slug"]: decision["risk_tier"]
        for decision in decisions
        if decision["action"] != "deferred"
    }
    included_slugs = {row["slug"] for row in included_rows}
    included_events = [
        row for row in event_rows if row["panda_slug"] in included_slugs and _eligible_event(row)
    ]
    required_source_ids = {
        source_id for row in included_rows for source_id in _split_ids(row["primary_source_ids"])
    }
    required_source_ids.update(
        source_id for row in included_events for source_id in _split_ids(row["source_ids"])
    )
    added_source_ids = []
    for source_id in sorted(required_source_ids - existing_source_ids):
        source_row = source_rows_by_id.get(source_id)
        if source_row is None:
            continue
        source["sources"].append(_source_record(source_row))
        added_source_ids.append(source_id)
    published_source_ids = {str(record["id"]) for record in source["sources"]}

    added_profile_slugs: list[str] = []
    preserved_profile_slugs: list[str] = []
    for row in included_rows:
        source_ids = [
            source_id
            for source_id in _split_ids(row["primary_source_ids"])
            if source_id in published_source_ids
        ]
        existing = existing_pandas_by_slug.get(row["slug"])
        if existing is None:
            record = _new_panda_record(
                row=row,
                panda_id=panda_ids_by_slug[row["slug"]],
                source_ids=source_ids,
                risk_tier=risk_tier_by_slug[row["slug"]],
                released_at=released_at,
            )
            source["pandas"].append(record)
            existing_pandas_by_slug[row["slug"]] = record
            added_profile_slugs.append(row["slug"])
        else:
            preserved_profile_slugs.append(row["slug"])

    added_profile_set = set(added_profile_slugs)
    added_rows = [row for row in included_rows if row["slug"] in added_profile_set]
    fact_changes = _upsert_facts(
        source=source,
        included_rows=added_rows,
        panda_ids_by_slug=panda_ids_by_slug,
        published_source_ids=published_source_ids,
        released_at=released_at,
    )
    event_changes = _upsert_events(
        source=source,
        event_rows=included_events,
        panda_ids_by_slug=panda_ids_by_slug,
        published_source_ids=published_source_ids,
    )
    residency_changes = _upsert_residencies(
        source=source,
        included_rows=added_rows,
        event_rows=included_events,
        panda_ids_by_slug=panda_ids_by_slug,
        published_source_ids=published_source_ids,
        released_at=released_at,
    )
    parentage_changes = _upsert_parentage(
        source=source,
        included_rows=added_rows,
        panda_ids_by_slug=panda_ids_by_slug,
        published_source_ids=published_source_ids,
    )
    media_changes = _ensure_empty_media(
        source=source,
        added_profile_slugs=added_profile_slugs,
        panda_ids_by_slug=panda_ids_by_slug,
    )

    for collection in COLLECTIONS:
        source.setdefault(collection, [])
        source[collection].sort(key=lambda item: str(item["id"]))
        _assert_unique_ids(source[collection], collection)

    source["dataset"] = {
        **source["dataset"],
        "version": release_version,
        "base_dataset_version": base_version,
        "title": f"PandaAtlas collection release {release_version}",
        "core_panda_count": len(source["pandas"]),
        "expansion_panda_ids": sorted(
            {
                *source["dataset"].get("expansion_panda_ids", []),
                *(panda_ids_by_slug[slug] for slug in added_profile_slugs),
            }
        ),
    }

    source_json = (
        json.dumps(
            source,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
            allow_nan=False,
        )
        + "\n"
    )
    input_hashes = {
        "base_source": _sha256_text(
            json.dumps(base_source_state, ensure_ascii=False, sort_keys=True, allow_nan=False)
        ),
        **{
            filename: _sha256_bytes((curation_dir / filename).read_bytes())
            for filename in ("pandas.csv", "events.csv", "sources.csv", "media.csv")
        },
    }
    report_core = {
        "schema_version": COLLECTION_RELEASE_SCHEMA_VERSION,
        "base_dataset_version": base_version,
        "release_version": release_version,
        "publication_batch_id": publication_batch_id,
        "released_at": released_at.isoformat().replace("+00:00", "Z"),
        "input_sha256": input_hashes,
        "source_sha256": _sha256_text(source_json),
        "summary": {
            "base_panda_count": len(base_source_state.get("pandas", [])),
            "eligible_curation_panda_count": len(eligible_rows),
            "included_curation_panda_count": len(included_rows),
            "added_profile_count": len(added_profile_slugs),
            "preserved_profile_count": len(preserved_profile_slugs),
            "deferred_profile_count": sum(
                decision["action"] == "deferred" for decision in decisions
            ),
            "result_panda_count": len(source["pandas"]),
            "risk_tier_counts": _counts(decision["risk_tier"] for decision in decisions),
            "action_counts": _counts(decision["action"] for decision in decisions),
            "added_source_count": len(added_source_ids),
            "fact_changes": fact_changes,
            "event_changes": event_changes,
            "residency_changes": residency_changes,
            "parentage_changes": parentage_changes,
            "media_changes": media_changes,
        },
        "added_profile_slugs": added_profile_slugs,
        "preserved_profile_slugs": preserved_profile_slugs,
        "added_source_ids": added_source_ids,
        "profile_decisions": decisions,
        "write_boundary": {
            "reviewed_batch": "local-only-until-explicit-apply",
            "public_release": "local-only-until-explicit-apply",
            "d1_activation": False,
            "r2_upload": False,
            "deployment": False,
        },
    }
    report_id = "collection-release-" + _sha256_text(
        json.dumps(report_core, ensure_ascii=False, sort_keys=True, allow_nan=False)
    )
    report = {"report_id": report_id, **report_core}
    return CollectionReleaseCandidate(source_state=source, report=report)


def _validate_inputs(
    *,
    base_source_state: dict[str, Any],
    curation_dir: Path,
    release_version: str,
    publication_batch_id: str,
    released_at: datetime,
) -> None:
    if released_at.tzinfo is None or released_at.utcoffset() is None:
        raise ValueError("released_at must be timezone-aware")
    if not _RELEASE_VERSION_PATTERN.fullmatch(release_version):
        raise ValueError("release_version must use YYYY.MM.DD.N format")
    if not publication_batch_id.strip():
        raise ValueError("publication_batch_id is required")
    dataset = base_source_state.get("dataset")
    if not isinstance(dataset, dict) or not dataset.get("version"):
        raise ValueError("base source state has no dataset version")
    if str(dataset["version"]) == release_version:
        raise ValueError("release version must differ from the base version")
    for filename in ("pandas.csv", "events.csv", "sources.csv", "media.csv"):
        if not (curation_dir / filename).is_file():
            raise FileNotFoundError(curation_dir / filename)


def _eligible_panda(row: dict[str, str]) -> bool:
    return (
        row["review_status"] in ELIGIBLE_REVIEW_STATUSES
        and row["evidence_status"] == ELIGIBLE_EVIDENCE_STATUS
    )


def _eligible_event(row: dict[str, str]) -> bool:
    return (
        row["review_status"] in ELIGIBLE_REVIEW_STATUSES
        and row["evidence_status"] == ELIGIBLE_EVIDENCE_STATUS
        and row["event_date_precision"] == "day"
        and bool(row["event_date"].strip())
    )


def _profile_gaps(row: dict[str, str]) -> list[str]:
    gaps = []
    if row["gender"] not in {"male", "female"}:
        gaps.append("known_gender")
    if not row["birth_date"].strip() or row["birth_date_precision"] != "day":
        gaps.append("exact_birth_date")
    if row["status"] not in {"alive", "deceased"}:
        gaps.append("known_life_status")
    if not row["current_location"].strip():
        gaps.append("current_location")
    return gaps


def _has_reviewed_residency_start(
    panda_row: dict[str, str],
    event_rows: list[dict[str, str]],
) -> bool:
    location = panda_row["current_location"].strip()
    return any(
        event["panda_slug"] == panda_row["slug"]
        and _eligible_event(event)
        and event["event_type"] in {"arrival", "transfer"}
        and event["location"].strip() == location
        for event in event_rows
    )


def _decision(
    row: dict[str, str],
    *,
    action: str,
    risk_tier: str,
    gaps: list[str],
    reasons: tuple[str, ...],
) -> dict[str, Any]:
    return {
        "slug": row["slug"],
        "action": action,
        "risk_tier": risk_tier,
        "gaps": sorted(gaps),
        "reasons": list(reasons),
        "review_status": row["review_status"],
        "evidence_status": row["evidence_status"],
        "source_ids": _split_ids(row["primary_source_ids"]),
    }


def _source_record(row: dict[str, str]) -> dict[str, Any]:
    title = row["title"].strip()
    language = "zh-Hans" if _CJK_PATTERN.search(title) else "en"
    return _record(
        row["source_id"],
        {
            "publisher": row["publisher"].strip(),
            "title": title,
            "url": row["url"].strip(),
            "published_at": row["published_date"].strip() or None,
            "last_verified_at": row["accessed_at"].strip(),
            "language": language,
            "access_state": "accessible",
            "evidence_tier": row["reliability"].strip() or "reviewed_curation_source",
        },
        f"Allowed use: {row['allowed_use']}. {row['notes']}".strip(),
    )


def _new_panda_record(
    *,
    row: dict[str, str],
    panda_id: str,
    source_ids: list[str],
    risk_tier: str,
    released_at: datetime,
) -> dict[str, Any]:
    names = [
        {
            "language": "zh-Hans",
            "value": row["name_zh"].strip(),
            "kind": "official",
            "primary": True,
            "source_ids": source_ids,
        },
        {
            "language": "en",
            "value": row["name_en"].strip(),
            "kind": "official_romanization",
            "primary": True,
            "source_ids": source_ids,
        },
    ]
    public: dict[str, Any] = {
        "canonical_slug": row["slug"],
        "legacy_slugs": [],
        "record_tier": ("complete_first_pass" if risk_tier == "high" else "identity_first_pass"),
        "names": names,
        "aliases": [],
        "external_identifiers": [],
        "content": _localized_content(row),
        "revision_summaries": [
            {"locale": "zh-CN", "summary": "由已审核收藏数据自动生成首轮档案。"},
            {
                "locale": "en",
                "summary": "Generated automatically from reviewed collection curation.",
            },
        ],
    }
    if row["gender"] in {"male", "female"}:
        public["sex"] = row["gender"]
    public["life_status"] = row["status"] if row["status"] in {"alive", "deceased"} else "unknown"
    return {
        "id": panda_id,
        "publication_status": "published",
        "public": public,
        "restricted": {
            "curator_notes": (
                "Generated by the deterministic collection release compiler from a reviewed and "
                "verified curation row."
            ),
            "compiled_at": released_at.isoformat().replace("+00:00", "Z"),
        },
    }


def _localized_content(row: dict[str, str]) -> list[dict[str, str]]:
    year = row["birth_date"][:4] if row["birth_date"] else None
    zh_parts = [row["name_zh"].strip()]
    if year:
        zh_parts.append(f"{year} 年出生")
    if row["current_location"].strip():
        zh_parts.append(f"收藏记录中的现居地为 {row['current_location'].strip()}")
    zh_summary = "，".join(zh_parts) + "。"
    en_summary = row["intro"].strip()
    if not en_summary:
        en_parts = [row["name_en"].strip()]
        if year:
            en_parts.append(f"born in {year}")
        if row["current_location"].strip():
            en_parts.append(f"listed at {row['current_location'].strip()}")
        en_summary = ", ".join(en_parts) + "."
    return [
        {"locale": "zh-CN", "translation_status": "approved", "summary": zh_summary},
        {"locale": "en", "translation_status": "approved", "summary": en_summary},
    ]


def _upsert_facts(
    *,
    source: dict[str, Any],
    included_rows: list[dict[str, str]],
    panda_ids_by_slug: dict[str, str],
    published_source_ids: set[str],
    released_at: datetime,
) -> dict[str, int]:
    by_id = {str(record["id"]): record for record in source["facts"]}
    added = 0
    replaced = 0
    for row in included_rows:
        source_ids = [
            value
            for value in _split_ids(row["primary_source_ids"])
            if value in published_source_ids
        ]
        verified_at = released_at.date().isoformat()
        definitions: list[tuple[str, str, str, str | None, str, int | None]] = []
        if row["birth_date"].strip() and row["birth_date_precision"] == "day":
            definitions.append(
                (
                    "birth-date",
                    "birth_date",
                    row["birth_date"].strip(),
                    None,
                    "stable_identity_fact",
                    None,
                )
            )
        if row["gender"] in {"male", "female"}:
            definitions.append(("sex", "sex", row["gender"], None, "stable_identity_fact", None))
        if row["birthplace"].strip():
            definitions.append(
                (
                    "birthplace",
                    "birthplace",
                    row["birthplace"].strip(),
                    None,
                    "stable_identity_fact",
                    None,
                )
            )
        if row["current_location"].strip():
            definitions.append(
                (
                    "current-coarse-location",
                    "current_coarse_location",
                    row["current_location"].strip(),
                    "facility_level",
                    "current_location",
                    180,
                )
            )
        for suffix, field, value, precision, freshness_policy, max_age_days in definitions:
            fact_id = f"fact-{row['slug']}-{suffix}"
            public: dict[str, Any] = {
                "subject_id": panda_ids_by_slug[row["slug"]],
                "field": field,
                "value": value,
                "conclusion_status": "confirmed",
                "source_ids": source_ids,
                "last_verified_at": verified_at,
                "freshness": {
                    "policy": freshness_policy,
                    "max_age_days": max_age_days,
                    "state": "current",
                },
            }
            if precision:
                public["precision"] = precision
            new_record = _record(
                fact_id,
                public,
                "Compiled from reviewed collection curation.",
            )
            if fact_id in by_id:
                source["facts"][source["facts"].index(by_id[fact_id])] = new_record
                by_id[fact_id] = new_record
                replaced += 1
            else:
                source["facts"].append(new_record)
                by_id[fact_id] = new_record
                added += 1
    return {"added": added, "replaced": replaced}


def _upsert_events(
    *,
    source: dict[str, Any],
    event_rows: list[dict[str, str]],
    panda_ids_by_slug: dict[str, str],
    published_source_ids: set[str],
) -> dict[str, int]:
    by_id = {str(record["id"]): record for record in source["events"]}
    semantic_keys = {
        (str(participant), str(public.get("event_type")), str(public.get("event_date")))
        for record in source["events"]
        for public in (record.get("public", {}),)
        for participant in public.get("participants", [])
    }
    added = 0
    replaced = 0
    skipped_missing_source = 0
    skipped_existing_semantic = 0
    for row in sorted(event_rows, key=lambda item: item["event_id"]):
        source_ids = [
            value for value in _split_ids(row["source_ids"]) if value in published_source_ids
        ]
        if not source_ids:
            skipped_missing_source += 1
            continue
        event_type = row["event_type"].strip().replace("-", "_")
        event_date = row["event_date"].strip()
        panda_id = panda_ids_by_slug[row["panda_slug"]]
        semantic_key = (panda_id, event_type, event_date)
        if row["event_id"] not in by_id and semantic_key in semantic_keys:
            skipped_existing_semantic += 1
            continue
        participants = [panda_id]
        participants.extend(
            panda_ids_by_slug[slug]
            for slug in _split_ids(row["related_slugs"])
            if slug in panda_ids_by_slug
        )
        public: dict[str, Any] = {
            "event_type": event_type,
            "event_status": "completed",
            "event_date": event_date,
            "participants": sorted(set(participants)),
            "source_ids": source_ids,
            "changes_current_residency": row["event_type"] in {"arrival", "transfer"},
        }
        if row["location"].strip():
            public["to_coarse_location"] = row["location"].strip()
        new_record = _record(
            row["event_id"],
            public,
            "Compiled from a reviewed exact-date collection event.",
        )
        if row["event_id"] in by_id:
            source["events"][source["events"].index(by_id[row["event_id"]])] = new_record
            by_id[row["event_id"]] = new_record
            replaced += 1
        else:
            source["events"].append(new_record)
            by_id[row["event_id"]] = new_record
            added += 1
        semantic_keys.update(
            (participant, event_type, event_date) for participant in public["participants"]
        )
    return {
        "added": added,
        "replaced": replaced,
        "skipped_missing_source": skipped_missing_source,
        "skipped_existing_semantic": skipped_existing_semantic,
    }


def _upsert_residencies(
    *,
    source: dict[str, Any],
    included_rows: list[dict[str, str]],
    event_rows: list[dict[str, str]],
    panda_ids_by_slug: dict[str, str],
    published_source_ids: set[str],
    released_at: datetime,
) -> dict[str, int]:
    existing_by_panda = {
        str(record.get("public", {}).get("panda_id")): record for record in source["residencies"]
    }
    events_by_slug: dict[str, list[dict[str, str]]] = {}
    for event in event_rows:
        events_by_slug.setdefault(event["panda_slug"], []).append(event)
    added = 0
    skipped_without_start = 0
    for row in included_rows:
        panda_id = panda_ids_by_slug[row["slug"]]
        if panda_id in existing_by_panda or not row["current_location"].strip():
            continue
        candidates = [
            event
            for event in events_by_slug.get(row["slug"], [])
            if event["event_type"] in {"arrival", "transfer"}
            and event["location"].strip() == row["current_location"].strip()
        ]
        if not candidates:
            skipped_without_start += 1
            continue
        start_event = max(candidates, key=lambda event: event["event_date"])
        source_ids = [
            value
            for value in (
                _split_ids(row["primary_source_ids"]) + _split_ids(start_event["source_ids"])
            )
            if value in published_source_ids
        ]
        source["residencies"].append(
            _record(
                f"res-{row['slug']}-current",
                {
                    "panda_id": panda_id,
                    "coarse_location": row["current_location"].strip(),
                    "residency_type": "primary",
                    "start_date": start_event["event_date"],
                    "end_date": None,
                    "status": "confirmed",
                    "source_ids": sorted(set(source_ids)),
                    "last_verified_at": released_at.date().isoformat(),
                },
                (
                    "Current coarse residency derived from a matching reviewed arrival or "
                    "transfer event."
                ),
            )
        )
        added += 1
    return {"added": added, "skipped_without_reviewed_start": skipped_without_start}


def _upsert_parentage(
    *,
    source: dict[str, Any],
    included_rows: list[dict[str, str]],
    panda_ids_by_slug: dict[str, str],
    published_source_ids: set[str],
) -> dict[str, int]:
    by_id = {str(record["id"]): record for record in source["parentage_assertions"]}
    added = 0
    replaced = 0
    for row in included_rows:
        source_ids = [
            value
            for value in _split_ids(row["primary_source_ids"])
            if value in published_source_ids
        ]
        for role, parent_slug in (
            ("father", row["father_slug"].strip()),
            ("mother", row["mother_slug"].strip()),
        ):
            if not parent_slug or parent_slug not in panda_ids_by_slug or not source_ids:
                continue
            assertion_id = f"parent-{row['slug']}-{role}"
            new_record = _record(
                assertion_id,
                {
                    "child_id": panda_ids_by_slug[row["slug"]],
                    "parent_id": panda_ids_by_slug[parent_slug],
                    "role": role,
                    "source_ids": source_ids,
                    "status": "confirmed",
                },
                "Compiled only from an explicit canonical parent slug in reviewed curation.",
            )
            if assertion_id in by_id:
                source["parentage_assertions"][
                    source["parentage_assertions"].index(by_id[assertion_id])
                ] = new_record
                by_id[assertion_id] = new_record
                replaced += 1
            else:
                source["parentage_assertions"].append(new_record)
                by_id[assertion_id] = new_record
                added += 1
    return {"added": added, "replaced": replaced}


def _ensure_empty_media(
    *,
    source: dict[str, Any],
    added_profile_slugs: list[str],
    panda_ids_by_slug: dict[str, str],
) -> dict[str, int]:
    panda_ids_with_media = {
        str(record.get("public", {}).get("panda_id")) for record in source["media"]
    }
    added = 0
    for slug in sorted(added_profile_slugs):
        panda_id = panda_ids_by_slug[slug]
        if panda_id in panda_ids_with_media:
            continue
        source["media"].append(
            _record(
                f"media-{slug}-none",
                {
                    "display_mode": "designed_empty_state",
                    "license_state": "no_licensed_media",
                    "panda_id": panda_id,
                    "source_ids": [],
                },
                "No processed release media is attached to this collection profile yet.",
            )
        )
        added += 1
    return {"added_empty_states": added}


def _record(record_id: str, public: dict[str, Any], note: str) -> dict[str, Any]:
    return {
        "id": record_id,
        "publication_status": "published",
        "public": public,
        "restricted": {"curator_notes": note},
    }


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _split_ids(value: str) -> list[str]:
    return sorted({item.strip() for item in value.split(";") if item.strip()})


def _assert_unique_ids(records: list[dict[str, Any]], collection: str) -> None:
    ids = [str(record["id"]) for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError(f"Duplicate record IDs in {collection}")


def _counts(values: Iterable[str]) -> dict[str, int]:
    result: dict[str, int] = {}
    for value in values:
        result[value] = result.get(value, 0) + 1
    return dict(sorted(result.items()))


def _sha256_text(value: str) -> str:
    return _sha256_bytes(value.encode("utf-8"))


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


__all__ = [
    "COLLECTION_RELEASE_SCHEMA_VERSION",
    "CollectionReleaseCandidate",
    "build_collection_release_candidate",
]
