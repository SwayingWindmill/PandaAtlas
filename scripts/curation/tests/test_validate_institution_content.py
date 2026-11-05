from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "validate_institution_content.py"
SPEC = importlib.util.spec_from_file_location("validate_institution_content", MODULE_PATH)
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

    def test_checks_viewing_windows_and_photo_spots(self) -> None:
        guide = lambda c: c["institutions"][0]["places"][0]["visitGuide"]
        content = copy.deepcopy(VALID)
        guide(content).update(
            viewing={"activeWindows": [{"start": "09:00", "end": "11:00"}], "napWindow": {"start": "12:00", "end": "14:30"}},
            photoSpots=[{"name": {"zh": "外场东侧"}}],
        )
        self.assertEqual(BUILDER.validate_content(content), [])
        self.assert_error(lambda c: guide(c).update(viewing={"activeWindows": []}), "activeWindows")
        self.assert_error(lambda c: guide(c).update(viewing={"activeWindows": [{"start": "11:00", "end": "10:00"}]}), "start before")
        self.assert_error(
            lambda c: guide(c).update(viewing={"activeWindows": [{"start": "09:00", "end": "11:00"}, {"start": "10:00", "end": "12:00"}]}),
            "overlap",
        )
        self.assert_error(lambda c: guide(c).update(photoSpots=[{"window": {"start": "09:00", "end": "10:00"}}]), "needs a name")

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


if __name__ == "__main__":
    unittest.main()
