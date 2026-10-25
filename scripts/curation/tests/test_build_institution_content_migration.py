from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "build_institution_content_migration.py"
SPEC = importlib.util.spec_from_file_location("build_institution_content_migration", MODULE_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)

VALID = {
    "institutions": [
        {
            "slug": "sample-zoo",
            "nameZh": "示例动物园",
            "nameEn": "Sample Zoo",
            "countryCode": "US",
            "profile": {
                "kind": "zoo",
                "summary": {"en": "A zoo's pandas."},
                "websiteUrl": "https://zoo.example/",
                "verifiedOn": "2026-10-23",
                "sourceUrls": ["https://zoo.example/pandas"],
            },
            "places": [
                {
                    "slug": "sample-zoo",
                    "longitude": -77.05,
                    "latitude": 38.93,
                    "visitGuide": {
                        "openingHours": {"en": "9 to 5"},
                        "tips": [{"topic": "best_time", "text": {"zh": "早上去"}}],
                        "verifiedOn": "2026-10-23",
                        "sourceUrls": ["https://zoo.example/visit"],
                    },
                },
                {"slug": "sample-zoo-annex"},
            ],
        }
    ]
}


class ValidateContentTests(unittest.TestCase):
    def test_valid_content_has_no_errors(self) -> None:
        self.assertEqual(BUILDER.validate_content(VALID), [])

    def test_repository_data_file_is_valid(self) -> None:
        content = json.loads(BUILDER.DATA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(BUILDER.validate_content(content), [])

    def assert_error(self, mutate, fragment: str) -> None:
        content = copy.deepcopy(VALID)
        mutate(content)
        errors = BUILDER.validate_content(content)
        self.assertTrue(any(fragment in error for error in errors), errors)

    def test_rejects_unknown_kind(self) -> None:
        self.assert_error(lambda c: c["institutions"][0]["profile"].update(kind="aquarium"), "profile.kind")

    def test_rejects_plain_http_urls(self) -> None:
        self.assert_error(
            lambda c: c["institutions"][0]["profile"].update(liveCamUrl="http://zoo.example/cam"),
            "liveCamUrl",
        )

    def test_requires_sources_and_a_real_day(self) -> None:
        self.assert_error(lambda c: c["institutions"][0]["profile"].update(sourceUrls=[]), "sourceUrls")
        self.assert_error(lambda c: c["institutions"][0]["profile"].update(verifiedOn="2026-02-30"), "verifiedOn")

    def test_rejects_unknown_tip_topic_and_empty_text(self) -> None:
        guide = lambda c: c["institutions"][0]["places"][0]["visitGuide"]
        self.assert_error(lambda c: guide(c)["tips"].append({"topic": "food", "text": {"en": "x"}}), "topic")
        self.assert_error(lambda c: guide(c).update(admission={"en": " "}), "admission")

    def test_rejects_half_a_coordinate_and_duplicate_places(self) -> None:
        self.assert_error(lambda c: c["institutions"][0]["places"][0].pop("latitude"), "go together")
        self.assert_error(
            lambda c: c["institutions"][0]["places"].append({"slug": "sample-zoo"}),
            "listed twice",
        )


class RenderMigrationTests(unittest.TestCase):
    def test_upserts_institutions_and_updates_only_facility_places(self) -> None:
        sql = BUILDER.render_migration(VALID)
        self.assertIn("on conflict (slug) do update", sql)
        self.assertIn("'{\"kind\":\"zoo\",\"summary\":{\"en\":\"A zoo''s pandas.\"}", sql)
        self.assertIn("ST_SetSRID(ST_MakePoint(-77.05, 38.93), 4326)", sql)
        self.assertEqual(sql.count("and place_type = 'facility';"), 2)
        annex = sql.split("where slug = 'sample-zoo-annex'")[0].rsplit("update place.places set", 1)[1]
        self.assertNotIn("center", annex)
        self.assertIn("visit_guide = null", annex)
        self.assertTrue(sql.startswith("-- Generated") and sql.rstrip().endswith("commit;"))

    def test_check_and_write_add_a_new_migration_only_when_content_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "institutions.json"
            migrations = root / "migrations"
            migrations.mkdir()
            (migrations / "0001_schema.sql").write_text("select 1;\n", encoding="utf-8")
            data_path.write_text(json.dumps(VALID), encoding="utf-8")
            original = (BUILDER.ROOT, BUILDER.DATA_PATH, BUILDER.MIGRATIONS_DIR)
            BUILDER.ROOT, BUILDER.DATA_PATH, BUILDER.MIGRATIONS_DIR = root, data_path, migrations
            try:
                self.assertEqual(BUILDER.main(["--check"]), 1)
                self.assertEqual(BUILDER.main(["--write"]), 0)
                self.assertTrue((migrations / "0002_institution_content.sql").exists())
                self.assertEqual(BUILDER.main(["--check"]), 0)
                self.assertEqual(BUILDER.main(["--write"]), 0)
                self.assertFalse((migrations / "0003_institution_content.sql").exists())

                changed = copy.deepcopy(VALID)
                changed["institutions"][0]["nameEn"] = "Sample Zoo and Gardens"
                data_path.write_text(json.dumps(changed), encoding="utf-8")
                self.assertEqual(BUILDER.main(["--check"]), 1)
                self.assertEqual(BUILDER.main(["--write"]), 0)
                self.assertTrue((migrations / "0003_institution_content.sql").exists())
            finally:
                BUILDER.ROOT, BUILDER.DATA_PATH, BUILDER.MIGRATIONS_DIR = original


if __name__ == "__main__":
    unittest.main()
