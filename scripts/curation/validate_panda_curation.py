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
MEDIA_REVIEW_STATUSES = {"draft", "approved", "rejected", "withdrawn"}
MEDIA_FIELDS = (
    "panda_slug",
    "asset",
    "source_url",
    "rights",
    "credit",
    "alt_zh",
    "alt_en",
    "review_status",
    "notes",
)
APPROVED_MEDIA_FIELDS = (
    "panda_slug",
    "asset",
    "source_url",
    "rights",
    "credit",
    "alt_zh",
    "alt_en",
)
UNKNOWN_RIGHTS = {"unknown", "unclear", "copyright_unknown", "none"}


def read_csv(path: Path) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return tuple(reader.fieldnames or ()), list(reader)


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


def validate_curation(curation_dir: Path) -> tuple[list[str], dict[str, int]]:
    errors: list[str] = []
    paths = {
        "sources": curation_dir / "sources.csv",
        "pandas": curation_dir / "pandas.csv",
        "events": curation_dir / "events.csv",
        "media": curation_dir / "media.csv",
    }
    for path in paths.values():
        require(path.exists(), f"missing required curation file: {path}", errors)
    if errors:
        return errors, {}

    _, sources = read_csv(paths["sources"])
    _, pandas = read_csv(paths["pandas"])
    _, events = read_csv(paths["events"])
    media_fields, media = read_csv(paths["media"])

    require(
        media_fields == MEDIA_FIELDS,
        "media.csv header must equal " + ",".join(MEDIA_FIELDS),
        errors,
    )

    source_ids = {row["source_id"] for row in sources}
    require(len(source_ids) == len(sources), "duplicate source_id in sources.csv", errors)

    panda_slugs = [row["slug"] for row in pandas]
    require(len(set(panda_slugs)) == len(panda_slugs), "duplicate slug in pandas.csv", errors)
    panda_slug_set = set(panda_slugs)
    panda_by_slug = {row["slug"]: row for row in pandas}

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
    approved_event_counts: dict[str, int] = {}
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
        if row["review_status"] == "approved" and row["evidence_status"] == "verified":
            approved_event_counts[row["panda_slug"]] = approved_event_counts.get(row["panda_slug"], 0) + 1

    media_keys: list[tuple[str, str]] = []
    approved_media_counts: dict[str, int] = {}
    for index, row in enumerate(media, start=2):
        panda_slug = row.get("panda_slug", "")
        label = f"media.csv[{panda_slug or index}]"
        require(panda_slug in panda_slug_set, f"{label}: unknown panda_slug {panda_slug!r}", errors)
        status = row.get("review_status", "")
        require(status in MEDIA_REVIEW_STATUSES, f"{label}: invalid review_status {status!r}", errors)
        asset = row.get("asset", "").strip()
        if asset:
            media_keys.append((panda_slug, asset))
        if status == "approved":
            for field in APPROVED_MEDIA_FIELDS:
                require(bool(row.get(field, "").strip()), f"{label}: approved media requires {field}", errors)
            source_url = row.get("source_url", "").strip()
            require(source_url.startswith("https://"), f"{label}: source_url must use https", errors)
            rights = row.get("rights", "").strip().lower()
            require(rights not in UNKNOWN_RIGHTS, f"{label}: approved media requires clear rights", errors)
            if panda_slug in panda_slug_set:
                approved_media_counts[panda_slug] = approved_media_counts.get(panda_slug, 0) + 1

    require(len(set(media_keys)) == len(media_keys), "duplicate panda_slug and asset in media.csv", errors)

    for slug, row in panda_by_slug.items():
        if row["review_status"] != "approved":
            continue
        label = f"pandas.csv[{slug}]"
        require(row["evidence_status"] == "verified", f"{label}: approved panda must be verified", errors)
        for field in ("name_zh", "name_en", "current_location", "primary_source_ids", "intro"):
            require(bool(row[field].strip()), f"{label}: approved panda requires {field}", errors)
        require(row["gender"] not in {"", "unknown"}, f"{label}: approved panda requires known gender", errors)
        require(row["status"] not in {"", "unknown"}, f"{label}: approved panda requires known status", errors)
        require(
            bool(row["birth_date"].strip() or row["birth_date_text"].strip()),
            f"{label}: approved panda requires birth_date or birth_date_text",
            errors,
        )
        require(
            approved_event_counts.get(slug, 0) >= 3,
            f"{label}: complete approved panda requires at least 3 approved verified events",
            errors,
        )
        require(
            approved_media_counts.get(slug, 0) >= 1,
            f"{label}: approved panda requires at least 1 approved photo",
            errors,
        )

    counts = {
        "sources": len(sources),
        "pandas": len(pandas),
        "events": len(events),
        "media": len(media),
    }
    return errors, counts


def main() -> int:
    errors, counts = validate_curation(CURATION_DIR)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(
        "OK: "
        f"{counts['sources']} sources, "
        f"{counts['pandas']} panda rows, "
        f"{counts['events']} event rows, "
        f"{counts['media']} media rows validated"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
