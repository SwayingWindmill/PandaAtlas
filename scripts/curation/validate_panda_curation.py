from __future__ import annotations

import csv
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CURATION_DIR = ROOT / "data" / "curation" / "pandas"

PANDA_GENDERS = {"male", "female", "unknown", ""}
PANDA_STATUSES = {"alive", "deceased", "unknown", ""}
DATE_PRECISIONS = {"day", "month", "year", "year_text", "age_text", "unknown", ""}
EVIDENCE_STATUSES = {"verified", "partial", "needs_primary_source"}
REVIEW_STATUSES = {"draft", "reviewed", "approved", "rejected"}


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def split_ids(value: str) -> list[str]:
    return [item.strip() for item in value.split(";") if item.strip()]


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def validate_date(value: str, row_label: str, errors: list[str]) -> None:
    if not value:
        return

    try:
        date.fromisoformat(value)
    except ValueError:
        errors.append(f"{row_label}: invalid ISO date {value!r}")


def main() -> int:
    errors: list[str] = []

    sources_path = CURATION_DIR / "sources.csv"
    pandas_path = CURATION_DIR / "pandas.csv"
    events_path = CURATION_DIR / "events.csv"

    for path in (sources_path, pandas_path, events_path):
        require(path.exists(), f"missing required curation file: {path}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    sources = read_csv(sources_path)
    pandas = read_csv(pandas_path)
    events = read_csv(events_path)

    source_ids = {row["source_id"] for row in sources}
    require(len(source_ids) == len(sources), "duplicate source_id in sources.csv", errors)

    panda_slugs = [row["slug"] for row in pandas]
    require(len(set(panda_slugs)) == len(panda_slugs), "duplicate slug in pandas.csv", errors)

    panda_slug_set = set(panda_slugs)

    for row in pandas:
        label = f"pandas.csv[{row.get('slug', '<missing slug>')}]"
        require(row["gender"] in PANDA_GENDERS, f"{label}: invalid gender {row['gender']!r}", errors)
        require(row["status"] in PANDA_STATUSES, f"{label}: invalid status {row['status']!r}", errors)
        require(
            row["birth_date_precision"] in DATE_PRECISIONS,
            f"{label}: invalid birth_date_precision {row['birth_date_precision']!r}",
            errors,
        )
        require(
            row["evidence_status"] in EVIDENCE_STATUSES,
            f"{label}: invalid evidence_status {row['evidence_status']!r}",
            errors,
        )
        require(
            row["review_status"] in REVIEW_STATUSES,
            f"{label}: invalid review_status {row['review_status']!r}",
            errors,
        )
        validate_date(row["birth_date"], label, errors)
        validate_date(row["death_date"], label, errors)

        if row["birth_date"]:
            require(
                row["birth_date_precision"] == "day",
                f"{label}: birth_date should only be filled when precision is day",
                errors,
            )

        for source_id in split_ids(row["primary_source_ids"]):
            require(source_id in source_ids, f"{label}: unknown source_id {source_id!r}", errors)

        for parent_field in ("father_slug", "mother_slug"):
            parent_slug = row[parent_field]
            if parent_slug:
                require(
                    parent_slug in panda_slug_set,
                    f"{label}: {parent_field} references missing panda slug {parent_slug!r}",
                    errors,
                )

    event_ids = [row["event_id"] for row in events]
    require(len(set(event_ids)) == len(event_ids), "duplicate event_id in events.csv", errors)

    for row in events:
        label = f"events.csv[{row.get('event_id', '<missing event_id>')}]"
        require(row["panda_slug"] in panda_slug_set, f"{label}: unknown panda_slug {row['panda_slug']!r}", errors)
        require(
            row["event_date_precision"] in DATE_PRECISIONS,
            f"{label}: invalid event_date_precision {row['event_date_precision']!r}",
            errors,
        )
        require(
            row["evidence_status"] in EVIDENCE_STATUSES,
            f"{label}: invalid evidence_status {row['evidence_status']!r}",
            errors,
        )
        require(
            row["review_status"] in REVIEW_STATUSES,
            f"{label}: invalid review_status {row['review_status']!r}",
            errors,
        )
        validate_date(row["event_date"], label, errors)

        for source_id in split_ids(row["source_ids"]):
            require(source_id in source_ids, f"{label}: unknown source_id {source_id!r}", errors)

        for related_slug in split_ids(row["related_slugs"]):
            require(related_slug in panda_slug_set, f"{label}: unknown related slug {related_slug!r}", errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print(
        "OK: "
        f"{len(sources)} sources, "
        f"{len(pandas)} panda rows, "
        f"{len(events)} event rows validated"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
