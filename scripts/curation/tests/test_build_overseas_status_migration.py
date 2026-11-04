from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "build_overseas_status_migration.py"
SPEC = importlib.util.spec_from_file_location("build_overseas_status_migration", MODULE_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def item(**overrides):
    base = {
        "status": "draft",
        "pandaSlug": "p-a",
        "stage": "abroad",
        "institutionSlug": "zoo-a",
        "sourceUrl": "https://example.org/n",
        "sourcePublisher": "园方",
        "updatedAt": "2026-10-02T09:00:00+08:00",
    }
    base.update(overrides)
    return base


class OverseasStatusTests(unittest.TestCase):
    def test_shipped_file_is_valid(self):
        document = json.loads(BUILDER.SOURCE.read_text(encoding="utf-8"))
        self.assertEqual(BUILDER.validate(document, BUILDER.institution_slugs()), [])

    def test_accepts_partial_dates(self):
        doc = {"version": "v", "items": [item(stage="return_announced", expectedReturn={"on": "2027-02", "precision": "month"})]}
        self.assertEqual(BUILDER.validate(doc, {"zoo-a"}), [])

    def test_rejects_bad_entries(self):
        for bad in (
            item(stage="gone"),
            item(sourceUrl="http://x.org"),
            item(stage="returned"),
            item(returnedOn="2026-01-01"),
            item(expectedReturn={"on": "2027-02-30", "precision": "day"}),
            item(note="x"),
        ):
            self.assertNotEqual(BUILDER.validate({"version": "v", "items": [bad]}, {"zoo-a"}), [], bad)

    def test_rejects_duplicates(self):
        self.assertTrue(BUILDER.validate({"version": "v", "items": [item(), item()]}, {"zoo-a"}))

    def test_sql_is_upsert(self):
        sql = BUILDER.migration_sql({"version": "v'1", "items": []})
        self.assertIn("on conflict (catalog_id)", sql)
        self.assertIn("'v''1'", sql)


if __name__ == "__main__":
    unittest.main()
