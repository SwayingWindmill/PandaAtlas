from __future__ import annotations

import csv
import hashlib
import io
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

ENTITY_COLLECTIONS = (
    "sources",
    "institutions",
    "facilities",
    "pandas",
    "facts",
    "parentage_assertions",
    "residencies",
    "events",
    "media",
)
SUPPORTED_PUBLIC_SCHEMA_VERSIONS = {"1.0.0"}
ALLOWED_PUBLIC_FIELDS = {
    "access_state",
    "aliases",
    "canonical_slug",
    "changes_current_residency",
    "child_id",
    "coarse_location",
    "conclusion_status",
    "content",
    "country_code",
    "display_mode",
    "birth_date",
    "birthplace",
    "current_location",
    "death_date",
    "end_date",
    "event_date",
    "event_status",
    "event_type",
    "evidence_tier",
    "external_identifiers",
    "facility_id",
    "facility_type",
    "field",
    "freshness",
    "from_facility_id",
    "gender",
    "kind",
    "intro",
    "is_featured",
    "language",
    "last_verified_at",
    "legacy_slugs",
    "license_state",
    "life_status",
    "locale",
    "localized_content",
    "locality",
    "max_age_days",
    "media_release",
    "name_en",
    "name_zh",
    "names",
    "panda_id",
    "parent_id",
    "participants",
    "policy",
    "precision",
    "primary",
    "published_at",
    "publisher",
    "record_tier",
    "residency_type",
    "revision_summaries",
    "role",
    "sex",
    "source_ids",
    "search_terms",
    "start_date",
    "state",
    "status",
    "subject_id",
    "summary",
    "system",
    "title",
    "tags",
    "to_coarse_location",
    "translation_status",
    "url",
    "value",
}
DROP_PUBLIC_FIELDS = {
    "precise_wildlife_location",
    "precise_location",
    "exact_coordinates",
    "exact_location",
}
SENSITIVE_FIELD_MARKERS = (
    "contact",
    "email",
    "phone",
    "personal",
    "private",
    "restricted",
    "curator",
    "review_owner",
    "evidence_body",
)
_OMIT = object()


class ProjectionSecurityError(ValueError):
    """Raised when public source state contains an unclassified sensitive field."""


class ProjectionCompatibilityError(ValueError):
    """Raised when projection code cannot preserve the requested public semantics."""


@dataclass(frozen=True)
class PublicReleaseInput:
    source_state: dict[str, Any]
    publication_batch_id: str
    projection_code_version: str
    database_migration_version: str
    released_at: datetime


@dataclass(frozen=True)
class PublicRelease:
    release_metadata: dict[str, str]
    manifest: dict[str, Any]
    files: dict[str, str]

    def checksum(self, filename: str) -> str:
        return hashlib.sha256(self.files[filename].encode("utf-8")).hexdigest()


def _canonical_json(value: object, *, pretty: bool = False) -> str:
    if pretty:
        return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("released_at must be timezone-aware")
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _sanitize_public_value(value: Any, *, path: str, published_sources: set[str]) -> Any:
    if isinstance(value, list):
        sanitized = [
            _sanitize_public_value(item, path=f"{path}[]", published_sources=published_sources)
            for item in value
        ]
        return [item for item in sanitized if item is not _OMIT]
    if not isinstance(value, dict):
        return value

    translation_status = value.get("translation_status")
    if translation_status is not None and translation_status != "approved":
        return _OMIT

    result: dict[str, Any] = {}
    for key in sorted(value):
        lowered = key.lower()
        if lowered in DROP_PUBLIC_FIELDS:
            continue
        if key not in ALLOWED_PUBLIC_FIELDS:
            classification = (
                "Sensitive"
                if any(marker in lowered for marker in SENSITIVE_FIELD_MARKERS)
                else "Unknown"
            )
            raise ProjectionSecurityError(
                f"{classification} public field is not allowed at {path}.{key}"
            )
        item = value[key]
        if key == "source_ids" and isinstance(item, list):
            result[key] = sorted(
                {str(source_id) for source_id in item if str(source_id) in published_sources}
            )
            continue
        sanitized = _sanitize_public_value(
            item,
            path=f"{path}.{key}",
            published_sources=published_sources,
        )
        if sanitized is not _OMIT:
            result[key] = sanitized
    return result


def _project_records(source_state: dict[str, Any]) -> list[dict[str, Any]]:
    published_sources = {
        str(record["id"])
        for record in source_state.get("sources", [])
        if record.get("publication_status") == "published"
    }
    records: list[dict[str, Any]] = []
    direct_records = source_state.get("records")
    if isinstance(direct_records, list):
        published_sources.update(
            str(record["id"])
            for record in direct_records
            if record.get("entity_type") in {"source", "sources"}
        )
        for source_record in direct_records:
            public = _sanitize_public_value(
                source_record.get("public", {}),
                path=f"records.{source_record.get('id', 'unknown')}.public",
                published_sources=published_sources,
            )
            records.append(
                {
                    "entity_type": str(source_record["entity_type"]),
                    "id": str(source_record["id"]),
                    "public": public,
                }
            )
        records.sort(key=lambda record: (record["entity_type"], record["id"]))
        return records
    for entity_type in ENTITY_COLLECTIONS:
        for source_record in source_state.get(entity_type, []):
            if source_record.get("publication_status") != "published":
                continue
            public = _sanitize_public_value(
                source_record.get("public", {}),
                path=f"{entity_type}.{source_record.get('id', 'unknown')}.public",
                published_sources=published_sources,
            )
            records.append(
                {
                    "entity_type": entity_type,
                    "id": str(source_record["id"]),
                    "public": public,
                }
            )
    records.sort(key=lambda record: (record["entity_type"], record["id"]))
    return records


def _panda_json(records: list[dict[str, Any]], release: dict[str, str]) -> str:
    pandas = [
        {"id": record["id"], **record["public"]}
        for record in records
        if record["entity_type"] == "pandas"
        and record["public"].get("record_tier") != "dependency_stub"
    ]
    return _canonical_json({"release": release, "records": pandas}, pretty=True)


def _panda_csv(records: list[dict[str, Any]], release: dict[str, str]) -> str:
    buffer = io.StringIO(newline="")
    fieldnames = [
        "dataset_release_version",
        "public_schema_version",
        "id",
        "canonical_slug",
        "name_zh",
        "name_en",
        "sex",
        "life_status",
        "public_json",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for record in records:
        if record["entity_type"] != "pandas":
            continue
        public = record["public"]
        if public.get("record_tier") == "dependency_stub":
            continue
        names = public.get("names", [])
        writer.writerow(
            {
                "dataset_release_version": release["dataset_release_version"],
                "public_schema_version": release["public_schema_version"],
                "id": record["id"],
                "canonical_slug": public.get("canonical_slug", ""),
                "name_zh": next(
                    (
                        name.get("value", "")
                        for name in names
                        if name.get("language") == "zh-Hans" and name.get("primary")
                    ),
                    "",
                ),
                "name_en": next(
                    (
                        name.get("value", "")
                        for name in names
                        if name.get("language") == "en" and name.get("primary")
                    ),
                    "",
                ),
                "sex": public.get("sex", "unknown"),
                "life_status": public.get("life_status", "unknown"),
                "public_json": _canonical_json(public),
            }
        )
    return buffer.getvalue()


def _sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _d1_sql(
    records: list[dict[str, Any]],
    release: dict[str, str],
    licenses: dict[str, Any],
) -> str:
    version = _sql_literal(release["dataset_release_version"])
    lines = [
        "begin immediate;",
        "insert into public_releases (",
        "  dataset_release_version, public_schema_version, database_migration_version,",
        "  publication_batch_id, projection_code_version, released_at, licenses_json",
        ") values (",
        "  "
        + ", ".join(
            _sql_literal(release[key])
            for key in (
                "dataset_release_version",
                "public_schema_version",
                "database_migration_version",
                "publication_batch_id",
                "projection_code_version",
                "released_at",
            )
        )
        + ", "
        + _sql_literal(_canonical_json(licenses)),
        ");",
    ]
    for record in records:
        lines.append(
            "insert into public_release_records "
            "(dataset_release_version, entity_type, entity_id, public_json) values ("
            f"{version}, {_sql_literal(record['entity_type'])}, {_sql_literal(record['id'])}, "
            f"{_sql_literal(_canonical_json(record['public']))});"
        )
    lines.extend(
        [
            "update public_release_pointer",
            "set dataset_release_version = "
            f"{version}, switched_at = {_sql_literal(release['released_at'])}",
            "where singleton = 1;",
            "commit;",
            "",
        ]
    )
    return "\n".join(lines)


def build_public_release(release_input: PublicReleaseInput) -> PublicRelease:
    dataset = release_input.source_state["dataset"]
    public_schema_version = str(dataset["public_schema_version"])
    if public_schema_version not in SUPPORTED_PUBLIC_SCHEMA_VERSIONS:
        raise ProjectionCompatibilityError(
            f"Unsupported Public Schema version: {public_schema_version}"
        )
    release = {
        "dataset_release_version": str(dataset["version"]),
        "public_schema_version": public_schema_version,
        "database_migration_version": release_input.database_migration_version,
        "publication_batch_id": release_input.publication_batch_id,
        "projection_code_version": release_input.projection_code_version,
        "released_at": _iso_z(release_input.released_at),
    }
    records = _project_records(release_input.source_state)
    files = {
        "pandas.csv": _panda_csv(records, release),
        "pandas.json": _panda_json(records, release),
        "d1.sql": _d1_sql(records, release, dataset["licenses"]),
    }
    counts = {
        entity_type: sum(record["entity_type"] == entity_type for record in records)
        for entity_type in ENTITY_COLLECTIONS
    }
    manifest_files = {
        filename: {
            "bytes": len(content.encode("utf-8")),
            "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        }
        for filename, content in sorted(files.items())
    }
    manifest = {
        **release,
        "licenses": dataset["licenses"],
        "record_counts": counts,
        "files": manifest_files,
    }
    return PublicRelease(release_metadata=release, manifest=manifest, files=files)
