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

    def test_rejects_two_places_at_one_map_point(self) -> None:
        self.assert_error(
            lambda c: c["institutions"][0]["places"].append(
                {"slug": "sample-zoo-copy", "longitude": -77.0503, "latitude": 38.9302}
            ),
            "share a map point",
        )

    def test_rejects_legacy_slugs_that_are_still_places_or_merged_twice(self) -> None:
        places = lambda c: c["institutions"][0]["places"]
        self.assert_error(lambda c: places(c)[0].update(legacySlugs=["sample-zoo-annex"]), "still listed as a place")
        self.assert_error(lambda c: places(c)[0].update(legacySlugs=["Old Slug"]), "kebab-case")
        self.assert_error(lambda c: places(c)[0].update(legacySlugs="old-zoo"), "must be a list")

        def merged_twice(content: dict) -> None:
            places(content)[0]["legacySlugs"] = ["old-zoo"]
            places(content)[1]["legacySlugs"] = ["old-zoo"]

        self.assert_error(merged_twice, "already merged into sample-zoo")


class MergeTests(unittest.TestCase):
    def test_panda_tags_must_use_the_surviving_slug(self) -> None:
        content = copy.deepcopy(VALID)
        content["institutions"][0]["places"][0]["legacySlugs"] = ["old-zoo"]
        with tempfile.TemporaryDirectory() as tmp:
            pandas = Path(tmp) / "pandas.csv"
            pandas.write_text("slug,tags\nmei-mei,sample-zoo\nlan-lan,giant-panda;old-zoo\n", encoding="utf-8")
            self.assertEqual(
                BUILDER.validate_panda_tags(content, pandas),
                ["pandas.csv[lan-lan]: tag old-zoo was merged; use sample-zoo"],
            )

    def test_repository_panda_tags_use_no_merged_slug(self) -> None:
        content = json.loads(BUILDER.DATA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(BUILDER.validate_panda_tags(content), [])

    def test_finds_served_places_that_look_like_one_place(self) -> None:
        places = [
            {"slug": "chengdu-base", "nameEn": "Chengdu Research Base of Giant Panda Breeding"},
            {"slug": "coarse-1", "nameEn": "Xinghan Hall, Chengdu Research Base of Giant Panda Breeding"},
            {"slug": "zoo-a", "nameZh": "动物园", "longitude": 1.0, "latitude": 2.0},
            {"slug": "zoo-b", "nameZh": "另一个", "longitude": 1.0002, "latitude": 2.0},
            {"slug": "china", "nameEn": "China"},
            {"slug": "china-zoo", "nameEn": "China Zoo"},
        ]
        findings = BUILDER.find_duplicate_places(places)
        self.assertEqual(len(findings), 2, findings)
        self.assertIn("chengdu-base and coarse-1", findings[0])
        self.assertIn("zoo-a and zoo-b look like one place (same map point)", findings[1])


class RenderMigrationTests(unittest.TestCase):
    def test_merges_legacy_slugs_before_updating_places(self) -> None:
        content = copy.deepcopy(VALID)
        content["institutions"][0]["places"][0]["legacySlugs"] = ["old-zoo", "older-zoo"]
        sql = BUILDER.render_migration(content)
        merge = "select place.merge_place('old-zoo', 'sample-zoo');"
        self.assertIn(merge, sql)
        self.assertIn("select place.merge_place('older-zoo', 'sample-zoo');", sql)
        self.assertLess(sql.index(merge), sql.index("insert into place.institutions"))
        self.assertNotIn("merge_place", BUILDER.render_migration(VALID))

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
