from __future__ import annotations

import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "validate_panda_curation.py"
SPEC = importlib.util.spec_from_file_location("validate_panda_curation", MODULE_PATH)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)

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
MEDIA_FIELDS = list(VALIDATOR.MEDIA_FIELDS)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def panda_row(**overrides: str) -> dict[str, str]:
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


def event_row(index: int, **overrides: str) -> dict[str, str]:
    row = {field: "" for field in EVENT_FIELDS}
    row.update(
        {
            "event_id": f"event-{index}",
            "panda_slug": "test-panda",
            "event_type": "milestone",
            "event_date": f"202{index}-01-02",
            "event_date_precision": "day",
            "source_ids": "src-official",
            "evidence_status": "verified",
            "review_status": "approved",
        }
    )
    row.update(overrides)
    return row


def media_row(**overrides: str) -> dict[str, str]:
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


class CurationContractTests(unittest.TestCase):
    def validate(
        self,
        *,
        pandas: list[dict[str, str]] | None = None,
        events: list[dict[str, str]] | None = None,
        media: list[dict[str, str]] | None = None,
    ) -> list[str]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_csv(root / "sources.csv", ["source_id"], [{"source_id": "src-official"}])
            write_csv(root / "pandas.csv", PANDA_FIELDS, pandas or [panda_row()])
            write_csv(root / "events.csv", EVENT_FIELDS, events or [])
            write_csv(root / "media.csv", MEDIA_FIELDS, media or [])
            errors, _ = VALIDATOR.validate_curation(root)
            return errors

    def test_draft_panda_does_not_require_photo(self) -> None:
        self.assertEqual(self.validate(), [])

    def test_approved_panda_does_not_require_complete_publication_metadata(self) -> None:
        errors = self.validate(
            pandas=[
                panda_row(
                    review_status="approved",
                    evidence_status="partial",
                    current_location="",
                    birth_date="",
                    birth_date_precision="unknown",
                    gender="unknown",
                    status="unknown",
                    primary_source_ids="",
                )
            ]
        )
        self.assertEqual(errors, [])

    def test_collection_only_media_allows_unknown_rights_and_missing_human_fields(self) -> None:
        errors = self.validate(
            media=[
                media_row(
                    review_status="collection_only",
                    rights="unknown",
                    credit="",
                    source_url="",
                    alt_zh="",
                    alt_en="",
                )
            ]
        )
        self.assertEqual(errors, [])

    def test_processable_media_requires_an_asset(self) -> None:
        errors = self.validate(media=[media_row(asset="")])
        self.assertIn("media.csv[test-panda]: processable media requires asset", errors)

    def test_invalid_date_is_rejected(self) -> None:
        errors = self.validate(events=[event_row(1, event_date="not-a-date")])
        self.assertIn("events.csv[event-1]: invalid ISO date 'not-a-date'", errors)

    def test_missing_panda_reference_is_rejected(self) -> None:
        errors = self.validate(events=[event_row(1, panda_slug="missing-panda")])
        self.assertIn("events.csv[event-1]: unknown panda_slug 'missing-panda'", errors)


if __name__ == "__main__":
    unittest.main()
