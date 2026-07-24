from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[2]
VAULT_DIR = ROOT / "data" / "local-panda-research"
SOURCES_PATH = VAULT_DIR / "sources.jsonl"
PLAN_PATH = VAULT_DIR / "collection-plan.json"
RECORDS_DIR = VAULT_DIR / "records"

SOURCE_REQUIRED_FIELDS = {
    "source_id",
    "publisher",
    "title",
    "url",
    "language",
    "region",
    "source_type",
    "authority",
    "access_mode",
    "automated_collection",
    "rights_status",
    "retrieved_at",
    "notes",
}

RECORD_REQUIRED_FIELDS = {
    "record_id",
    "subject",
    "category",
    "predicate",
    "value",
    "source_id",
    "source_locator",
    "source_language",
    "summary_zh",
    "evidence_level",
    "confidence",
    "review_status",
    "publication_status",
    "collected_at",
    "tags",
}

SUBJECT_TYPES = {
    "panda",
    "panda_family",
    "species",
    "institution",
    "media_collection",
    "research_programme",
    "historic_programme",
    "wild_population",
    "other",
}
EVIDENCE_LEVELS = {"direct", "secondary_lead", "inferred"}
CONFIDENCE_LEVELS = {"high", "medium", "low"}
REVIEW_STATUSES = {"captured", "needs_primary_source", "reviewed", "rejected"}
PUBLICATION_STATUSES = {"local_only"}


class ValidationError(ValueError):
    """Raised when the local research vault violates its data contract."""


def _non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _validate_timestamp(value: Any, label: str) -> str | None:
    if not _non_empty_string(value):
        return f"{label} must be a non-empty ISO-8601 timestamp"
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return f"{label} is not a valid ISO-8601 timestamp: {value!r}"
    if parsed.tzinfo is None:
        return f"{label} must include a timezone offset: {value!r}"
    return None


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValidationError(
                    f"{path.relative_to(ROOT)}:{line_number}: invalid JSON: {error.msg}"
                ) from error
            if not isinstance(value, dict):
                raise ValidationError(
                    f"{path.relative_to(ROOT)}:{line_number}: each JSONL line must be an object"
                )
            value["__line__"] = line_number
            value["__path__"] = str(path.relative_to(ROOT))
            rows.append(value)
    return rows


def _location(row: dict[str, Any]) -> str:
    return f"{row.get('__path__', '<memory>')}:{row.get('__line__', '?')}"


def _duplicates(values: Iterable[str]) -> set[str]:
    counts = Counter(values)
    return {value for value, count in counts.items() if count > 1}


def validate_sources(rows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    source_ids: list[str] = []

    for row in rows:
        location = _location(row)
        missing = sorted(SOURCE_REQUIRED_FIELDS - row.keys())
        if missing:
            errors.append(f"{location}: missing source fields: {', '.join(missing)}")
            continue

        source_id = row["source_id"]
        if not _non_empty_string(source_id) or not source_id.startswith("src-"):
            errors.append(f"{location}: source_id must be a non-empty src-* identifier")
        else:
            source_ids.append(source_id)

        for field in SOURCE_REQUIRED_FIELDS - {"url", "retrieved_at"}:
            if not _non_empty_string(row[field]):
                errors.append(f"{location}: {field} must be a non-empty string")

        url = row["url"]
        if not _non_empty_string(url) or not url.startswith("https://"):
            errors.append(f"{location}: url must use HTTPS")

        timestamp_error = _validate_timestamp(row["retrieved_at"], "retrieved_at")
        if timestamp_error:
            errors.append(f"{location}: {timestamp_error}")

    for duplicate in sorted(_duplicates(source_ids)):
        errors.append(f"duplicate source_id: {duplicate}")

    return errors


def validate_records(
    rows: list[dict[str, Any]],
    *,
    source_ids: set[str],
    categories: set[str],
) -> list[str]:
    errors: list[str] = []
    record_ids: list[str] = []

    for row in rows:
        location = _location(row)
        missing = sorted(RECORD_REQUIRED_FIELDS - row.keys())
        if missing:
            errors.append(f"{location}: missing record fields: {', '.join(missing)}")
            continue

        record_id = row["record_id"]
        if not _non_empty_string(record_id) or not record_id.startswith("lpr-"):
            errors.append(f"{location}: record_id must be a non-empty lpr-* identifier")
        else:
            record_ids.append(record_id)

        subject = row["subject"]
        if not isinstance(subject, dict):
            errors.append(f"{location}: subject must be an object")
        else:
            missing_subject = sorted({"type", "id", "label"} - subject.keys())
            if missing_subject:
                errors.append(
                    f"{location}: subject missing fields: {', '.join(missing_subject)}"
                )
            else:
                if subject["type"] not in SUBJECT_TYPES:
                    errors.append(
                        f"{location}: unsupported subject type: {subject['type']!r}"
                    )
                for field in ("id", "label"):
                    if not _non_empty_string(subject[field]):
                        errors.append(f"{location}: subject.{field} must be non-empty")

        category = row["category"]
        if category not in categories:
            errors.append(f"{location}: unsupported category: {category!r}")

        if not _non_empty_string(row["predicate"]):
            errors.append(f"{location}: predicate must be non-empty")
        if not _non_empty_string(row["source_locator"]):
            errors.append(f"{location}: source_locator must be non-empty")
        if not _non_empty_string(row["source_language"]):
            errors.append(f"{location}: source_language must be non-empty")
        if not _non_empty_string(row["summary_zh"]):
            errors.append(f"{location}: summary_zh must be non-empty")

        source_id = row["source_id"]
        if source_id not in source_ids:
            errors.append(f"{location}: unknown source_id: {source_id!r}")

        evidence_level = row["evidence_level"]
        if evidence_level not in EVIDENCE_LEVELS:
            errors.append(f"{location}: unsupported evidence_level: {evidence_level!r}")

        confidence = row["confidence"]
        if confidence not in CONFIDENCE_LEVELS:
            errors.append(f"{location}: unsupported confidence: {confidence!r}")

        review_status = row["review_status"]
        if review_status not in REVIEW_STATUSES:
            errors.append(f"{location}: unsupported review_status: {review_status!r}")

        publication_status = row["publication_status"]
        if publication_status not in PUBLICATION_STATUSES:
            errors.append(
                f"{location}: publication_status must remain local_only, got {publication_status!r}"
            )

        if evidence_level in {"secondary_lead", "inferred"} and review_status not in {
            "needs_primary_source",
            "rejected",
        }:
            errors.append(
                f"{location}: {evidence_level} records must need a primary source or be rejected"
            )

        tags = row["tags"]
        if not isinstance(tags, list) or any(not _non_empty_string(tag) for tag in tags):
            errors.append(f"{location}: tags must be a list of non-empty strings")

        timestamp_error = _validate_timestamp(row["collected_at"], "collected_at")
        if timestamp_error:
            errors.append(f"{location}: {timestamp_error}")

    for duplicate in sorted(_duplicates(record_ids)):
        errors.append(f"duplicate record_id: {duplicate}")

    return errors


def validate_vault(vault_dir: Path = VAULT_DIR) -> dict[str, int]:
    sources_path = vault_dir / "sources.jsonl"
    plan_path = vault_dir / "collection-plan.json"
    records_dir = vault_dir / "records"

    required_paths = [sources_path, plan_path, records_dir]
    missing = [str(path.relative_to(ROOT)) for path in required_paths if not path.exists()]
    if missing:
        raise ValidationError(f"missing local research paths: {', '.join(missing)}")

    with plan_path.open("r", encoding="utf-8-sig") as handle:
        plan = json.load(handle)
    if plan.get("mode") != "local_first_research":
        raise ValidationError("collection-plan.json mode must be local_first_research")
    if plan.get("publication_enabled") is not False:
        raise ValidationError("collection-plan.json must keep publication_enabled=false")

    categories_value = plan.get("categories")
    if not isinstance(categories_value, list) or not categories_value:
        raise ValidationError("collection-plan.json categories must be a non-empty list")
    categories = set(categories_value)

    sources = load_jsonl(sources_path)
    source_errors = validate_sources(sources)
    source_ids = {
        row["source_id"]
        for row in sources
        if isinstance(row.get("source_id"), str)
    }

    record_paths = sorted(records_dir.glob("*.jsonl"))
    if not record_paths:
        raise ValidationError("records directory must contain at least one .jsonl file")
    records = [row for path in record_paths for row in load_jsonl(path)]
    record_errors = validate_records(records, source_ids=source_ids, categories=categories)

    errors = source_errors + record_errors
    if errors:
        raise ValidationError("\n".join(errors))

    direct_count = sum(row["evidence_level"] == "direct" for row in records)
    lead_count = sum(row["evidence_level"] == "secondary_lead" for row in records)
    return {
        "sources": len(sources),
        "records": len(records),
        "direct_records": direct_count,
        "secondary_leads": lead_count,
        "categories_used": len({row["category"] for row in records}),
        "subjects": len(
            {(row["subject"]["type"], row["subject"]["id"]) for row in records}
        ),
    }


def main() -> int:
    try:
        summary = validate_vault()
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(f"Local panda research validation failed:\n{error}")
        return 1

    print(
        "Local panda research validation passed: "
        f"{summary['sources']} sources, "
        f"{summary['records']} records "
        f"({summary['direct_records']} direct, {summary['secondary_leads']} secondary leads), "
        f"{summary['subjects']} subjects, {summary['categories_used']} categories used."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
