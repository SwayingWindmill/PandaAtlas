from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

from app.domain.archive_relationships import ParentageAssertion
from app.domain.trusted_identity import normalize_identity_term

GOLDEN_DATASET_FILENAME = "mei-xiang-family.v1.json"
TRUSTED_SLUGS = ("mei-xiang", "tian-tian")


def _candidate_paths() -> tuple[Path, ...]:
    configured = os.getenv("PANDA_ATLAS_GOLDEN_DATASET_PATH")
    module_path = Path(__file__).resolve()
    candidates = [
        parent / "contracts" / "golden-dataset" / GOLDEN_DATASET_FILENAME
        for parent in module_path.parents
    ]
    candidates.append(
        Path.cwd() / "contracts" / "golden-dataset" / GOLDEN_DATASET_FILENAME
    )
    if configured:
        candidates.insert(0, Path(configured).expanduser())
    return tuple(dict.fromkeys(path.resolve() for path in candidates))


@lru_cache(maxsize=1)
def load_golden_dataset() -> dict[str, Any]:
    for path in _candidate_paths():
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    searched = ", ".join(str(path) for path in _candidate_paths())
    raise FileNotFoundError(f"Golden dataset not found. Searched: {searched}")


def _legacy_slug_records(public: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for value in public.get("legacy_slugs", []):
        if isinstance(value, str):
            records.append({"value": value, "source_ids": []})
        else:
            records.append(
                {
                    "value": str(value["value"]),
                    "source_ids": [str(source_id) for source_id in value.get("source_ids", [])],
                }
            )
    return records


def _identity_payload(record: dict[str, Any]) -> dict[str, Any]:
    public = record["public"]
    return {
        "stable_id": record["id"],
        "canonical_slug": public["canonical_slug"],
        "names": [
            {
                "value": name["value"],
                "language": name["language"],
                "kind": name["kind"],
                "primary": bool(name.get("primary", False)),
                "source_ids": list(name.get("source_ids", [])),
            }
            for name in public.get("names", [])
        ],
        "aliases": [
            {
                "value": alias["value"],
                "language": alias["language"],
                "kind": alias["kind"],
                "primary": bool(alias.get("primary", False)),
                "source_ids": list(alias.get("source_ids", [])),
            }
            for alias in public.get("aliases", [])
        ],
        "legacy_slugs": _legacy_slug_records(public),
        "external_identifiers": [
            {
                "system": identifier["system"],
                "value": identifier["value"],
                "source_ids": list(identifier.get("source_ids", [])),
            }
            for identifier in public.get("external_identifiers", [])
        ],
    }


def _search_terms(identity: dict[str, Any]) -> set[str]:
    terms = {identity["canonical_slug"]}
    terms.update(item["value"] for item in identity["names"])
    terms.update(item["value"] for item in identity["aliases"])
    terms.update(item["value"] for item in identity["legacy_slugs"])
    for identifier in identity["external_identifiers"]:
        terms.add(identifier["value"])
        terms.add(f"{identifier['system']}:{identifier['value']}")
    return {normalize_identity_term(term) for term in terms if term}


def _source_summaries(dataset: dict[str, Any], source_ids: set[str]) -> list[dict[str, Any]]:
    summaries = []
    for source in dataset.get("sources", []):
        if source["id"] not in source_ids or source.get("publication_status") != "published":
            continue
        public = source["public"]
        summaries.append(
            {
                "id": source["id"],
                "publisher": public["publisher"],
                "title": public["title"],
                "url": public["url"],
                "published_at": public.get("published_at"),
                "last_verified_at": public["last_verified_at"],
                "language": public["language"],
                "access_state": public["access_state"],
            }
        )
    return summaries


def _conclusions(dataset: dict[str, Any], panda_id: str) -> list[dict[str, Any]]:
    conclusions = []
    for fact in dataset.get("facts", []):
        if fact.get("publication_status") != "published":
            continue
        public = fact.get("public", {})
        if public.get("subject_id") != panda_id:
            continue
        conclusions.append(
            {
                "field": public["field"],
                "value": public.get("value"),
                "status": public["conclusion_status"],
                "last_verified_at": public["last_verified_at"],
                "assertion_ids": [fact["id"]],
                "source_ids": list(public.get("source_ids", [])),
                "candidate_values": list(public.get("candidate_values", [])),
                "superseded_values": list(public.get("superseded_values", [])),
            }
        )
    conclusions.sort(key=lambda item: item["field"])
    return conclusions


def _display_name(public: dict[str, Any], language: str) -> str | None:
    for name in public.get("names", []):
        if name.get("language") == language and name.get("primary", False):
            return str(name["value"])
    for name in public.get("names", []):
        if name.get("language") == language:
            return str(name["value"])
    return None


@lru_cache(maxsize=1)
def trusted_panda_details() -> tuple[dict[str, Any], ...]:
    dataset = load_golden_dataset()
    facilities = {facility["id"]: facility for facility in dataset.get("facilities", [])}
    records: list[dict[str, Any]] = []

    for record in dataset.get("pandas", []):
        public = record.get("public", {})
        if (
            record.get("publication_status") != "published"
            or public.get("canonical_slug") not in TRUSTED_SLUGS
        ):
            continue

        identity = _identity_payload(record)
        conclusions = _conclusions(dataset, record["id"])
        residencies = [
            {
                "id": residency["id"],
                "facility_id": residency_public.get("facility_id"),
                "coarse_location": residency_public.get("coarse_location"),
                "residency_type": residency_public["residency_type"],
                "start_date": residency_public["start_date"],
                "start_precision": residency_public.get("start_precision", "day"),
                "end_date": residency_public.get("end_date"),
                "end_precision": residency_public.get("end_precision")
                or ("day" if residency_public.get("end_date") else None),
                "status": residency_public["status"],
                "source_ids": residency_public.get("source_ids", []),
            }
            for residency in dataset.get("residencies", [])
            if residency.get("publication_status") == "published"
            and (residency_public := residency.get("public", {})).get("panda_id")
            == record["id"]
            and residency_public.get("source_ids")
        ]
        residencies.sort(key=lambda item: item["start_date"])
        current_residency = next(
            (
                item
                for item in reversed(residencies)
                if item["residency_type"] == "primary"
                and item["end_date"] is None
                and item["status"] in {"confirmed", "confirmed_country_level"}
            ),
            None,
        )
        events = [
            {
                "id": event["id"],
                "event_type": event_public["event_type"],
                "event_status": event_public["event_status"],
                "event_date": event_public["event_date"],
                "event_date_precision": event_public.get("event_date_precision", "day"),
                "participants": event_public.get("participants", []),
                "from_facility_id": event_public.get("from_facility_id"),
                "from_coarse_location": event_public.get("from_coarse_location"),
                "to_facility_id": event_public.get("to_facility_id"),
                "to_coarse_location": event_public.get("to_coarse_location"),
                "source_ids": event_public.get("source_ids", []),
                "changes_current_residency": bool(
                    event_public.get("changes_current_residency", False)
                ),
            }
            for event in dataset.get("events", [])
            if event.get("publication_status") == "published"
            and record["id"]
            in (event_public := event.get("public", {})).get("participants", [])
            and event_public.get("source_ids")
        ]
        events.sort(key=lambda item: (item["event_date"], item["id"]))
        source_ids = {
            source_id
            for section in (
                identity["names"],
                identity["aliases"],
                identity["legacy_slugs"],
                identity["external_identifiers"],
                conclusions,
                residencies,
                events,
            )
            for item in section
            for source_id in item.get("source_ids", [])
        }
        birth_date = next(
            (
                conclusion["value"]
                for conclusion in conclusions
                if conclusion["field"] == "birth_date"
            ),
            None,
        )
        current_facility_id = next(
            (
                conclusion["value"]
                for conclusion in conclusions
                if conclusion["field"] == "current_facility_id"
            ),
            None,
        )
        facility = facilities.get(current_facility_id)
        current_location = None
        if facility:
            current_location = _display_name(facility["public"], "zh-Hans") or _display_name(
                facility["public"], "en"
            )
        summaries = {
            content["locale"]: content["summary"]
            for content in public.get("content", [])
            if content.get("translation_status") == "approved"
        }

        records.append(
            {
                "id": record["id"],
                "slug": public["canonical_slug"],
                "name_zh": _display_name(public, "zh-Hans") or public["canonical_slug"],
                "name_en": _display_name(public, "en"),
                "gender": public.get("sex", "unknown"),
                "status": public.get("life_status", "unknown"),
                "birth_date": birth_date,
                "current_location": current_location,
                "cover_image_url": None,
                "intro": summaries.get("zh-CN") or summaries.get("en"),
                "birthplace": None,
                "tags": ["trusted-identity", "golden-dataset"],
                "father_id": None,
                "mother_id": None,
                "habitats": [],
                "media": [],
                "identity": identity,
                "conclusions": conclusions,
                "sources": _source_summaries(dataset, source_ids),
                "current_place": (
                    {
                        "facility_id": current_residency["facility_id"],
                        "coarse_location": current_residency["coarse_location"],
                        "status": current_residency["status"],
                    }
                    if current_residency
                    else None
                ),
                "residencies": residencies,
                "events": events,
                "_search_terms": sorted(_search_terms(identity)),
            }
        )

    return tuple(records)


def find_trusted_panda(reference: str) -> dict[str, Any] | None:
    normalized = normalize_identity_term(reference)
    if not normalized:
        return None
    for record in trusted_panda_details():
        if normalized in record["_search_terms"] or normalized == normalize_identity_term(
            record["id"]
        ):
            return record
    return None


def trusted_panda_matches(panda_id: str, query: str) -> bool:
    normalized = normalize_identity_term(query)
    if not normalized:
        return False
    for record in trusted_panda_details():
        if record["id"] == panda_id:
            return normalized in record["_search_terms"]
    return False


def public_trusted_panda_record(record: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in record.items() if not key.startswith("_")}


@lru_cache(maxsize=1)
def trusted_parentage_assertions() -> tuple[ParentageAssertion, ...]:
    dataset = load_golden_dataset()
    return tuple(
        ParentageAssertion(
            id=record["id"],
            child_id=UUID(public["child_id"]),
            parent_id=UUID(public["parent_id"]),
            role=public["role"],
            status=public["status"],
            publication_status=record["publication_status"],
            source_ids=tuple(public.get("source_ids", [])),
        )
        for record in dataset.get("parentage_assertions", [])
        if (public := record.get("public", {}))
    )


@lru_cache(maxsize=1)
def trusted_lineage_pandas() -> tuple[dict[str, Any], ...]:
    dataset = load_golden_dataset()
    records: list[dict[str, Any]] = []
    for record in dataset.get("pandas", []):
        if record.get("publication_status") != "published":
            continue
        public = record.get("public", {})
        conclusions = _conclusions(dataset, record["id"])
        birth_date = next(
            (
                conclusion["value"]
                for conclusion in conclusions
                if conclusion["field"] == "birth_date"
            ),
            None,
        )
        records.append(
            {
                "id": UUID(record["id"]),
                "slug": public["canonical_slug"],
                "name_zh": _display_name(public, "zh-Hans")
                or public["canonical_slug"],
                "name_en": _display_name(public, "en"),
                "gender": public.get("sex", "unknown"),
                "status": public.get("life_status", "unknown"),
                "birth_date": birth_date,
                "current_location": None,
                "cover_image_url": None,
                "intro": None,
                "tags": ["trusted-archive", "golden-dataset"],
            }
        )
    return tuple(records)
