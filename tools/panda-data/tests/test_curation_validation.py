from __future__ import annotations

import csv
from pathlib import Path

from panda_data.curation.validation import MEDIA_FIELDS, validate_curation

PANDA_FIELDS = [
    "slug",
    "name_zh",
    "name_en",
    "gender",
    "birth_date",
    "birth_date_precision",
    "birth_date_text",
    "death_date",
    "status",
    "birthplace",
    "current_location",
    "father_slug",
    "mother_slug",
    "intro",
    "tags",
    "is_featured",
    "primary_source_ids",
    "evidence_status",
    "review_status",
    "notes",
]
EVENT_FIELDS = [
    "event_id",
    "panda_slug",
    "event_type",
    "event_date",
    "event_date_precision",
    "location",
    "related_slugs",
    "source_ids",
    "evidence_status",
    "review_status",
    "notes",
]


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _panda_row(**overrides: str) -> dict[str, str]:
    row = {field: "" for field in PANDA_FIELDS}
    row.update(
        {
            "slug": "test-panda",
            "name_zh": "测试熊猫",
            "name_en": "Test Panda",
            "gender": "female",
            "birth_date": "2020-01-02",
            "birth_date_precision": "day",
            "status": "alive",
            "current_location": "Test Institution",
            "intro": "A source-backed test panda.",
            "primary_source_ids": "src-official",
            "evidence_status": "verified",
            "review_status": "draft",
        }
    )
    row.update(overrides)
    return row


def _event_row(**overrides: str) -> dict[str, str]:
    row = {field: "" for field in EVENT_FIELDS}
    row.update(
        {
            "event_id": "event-1",
            "panda_slug": "test-panda",
            "event_type": "milestone",
            "event_date": "2021-01-02",
            "event_date_precision": "day",
            "source_ids": "src-official",
            "evidence_status": "verified",
            "review_status": "approved",
        }
    )
    row.update(overrides)
    return row


def _media_row(**overrides: str) -> dict[str, str]:
    row = {field: "" for field in MEDIA_FIELDS}
    row.update(
        {
            "panda_slug": "test-panda",
            "asset": "https://upload.wikimedia.org/test-panda.jpg",
            "source_url": "https://commons.wikimedia.org/wiki/File:Test_Panda.jpg",
            "rights": "CC BY-SA 4.0",
            "credit": "Photo: Example Author / Wikimedia Commons",
            "alt_zh": "测试熊猫坐在竹子旁",
            "alt_en": "Test Panda sitting beside bamboo",
            "review_status": "approved",
        }
    )
    row.update(overrides)
    return row


def _validate(
    root: Path,
    *,
    pandas: list[dict[str, str]] | None = None,
    events: list[dict[str, str]] | None = None,
    media: list[dict[str, str]] | None = None,
) -> list[str]:
    _write_csv(root / "sources.csv", ["source_id"], [{"source_id": "src-official"}])
    _write_csv(root / "pandas.csv", PANDA_FIELDS, pandas or [_panda_row()])
    _write_csv(root / "events.csv", EVENT_FIELDS, events or [])
    _write_csv(root / "media.csv", list(MEDIA_FIELDS), media or [])
    errors, _ = validate_curation(root)
    return errors


def test_draft_panda_does_not_require_photo(tmp_path: Path) -> None:
    assert _validate(tmp_path) == []


def test_approved_panda_allows_partial_publication_metadata(tmp_path: Path) -> None:
    errors = _validate(
        tmp_path,
        pandas=[
            _panda_row(
                review_status="approved",
                evidence_status="partial",
                current_location="",
                birth_date="",
                birth_date_precision="unknown",
                gender="unknown",
                status="unknown",
                primary_source_ids="",
            )
        ],
    )
    assert errors == []


def test_collection_only_media_allows_unknown_rights(tmp_path: Path) -> None:
    errors = _validate(
        tmp_path,
        media=[
            _media_row(
                review_status="collection_only",
                rights="unknown",
                credit="",
                source_url="",
                alt_zh="",
                alt_en="",
            )
        ],
    )
    assert errors == []


def test_processable_media_requires_asset(tmp_path: Path) -> None:
    errors = _validate(tmp_path, media=[_media_row(asset="")])
    assert "media.csv[test-panda]: processable media requires asset" in errors


def test_invalid_date_and_missing_panda_reference_are_rejected(tmp_path: Path) -> None:
    errors = _validate(
        tmp_path,
        events=[_event_row(event_date="not-a-date", panda_slug="missing-panda")],
    )
    assert "events.csv[event-1]: invalid ISO date 'not-a-date'" in errors
    assert "events.csv[event-1]: unknown panda_slug 'missing-panda'" in errors
