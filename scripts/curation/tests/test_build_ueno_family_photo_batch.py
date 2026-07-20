from __future__ import annotations

import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "build_ueno_family_photo_batch.py"
SPEC = importlib.util.spec_from_file_location("build_ueno_family_photo_batch", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

TARGET_SLUGS = {"ri-ri", "shin-shin", "xiao-xiao", "lei-lei"}


def fake_manifest() -> dict[str, object]:
    records = []
    for index, slug in enumerate(sorted(TARGET_SLUGS), start=1):
        media_id = f"media-{slug}-{index:016x}"
        records.append(
            {
                "panda_slug": slug,
                "media_id": media_id,
                "source_url": f"https://commons.wikimedia.org/wiki/File:{slug}.jpg",
                "rights": "CC BY-SA 4.0",
                "credit": "Reviewed photographer / Wikimedia Commons",
                "alt_zh": f"{slug} 的审核照片",
                "alt_en": f"Reviewed photograph of {slug}",
                "derivatives": [
                    {
                        "kind": "width-480",
                        "filename": f"{media_id}-w480.webp",
                        "sha256": f"{index:064x}",
                        "mime_type": "image/webp",
                        "width": 480,
                        "height": 320,
                        "bytes": 1000 + index,
                    },
                    {
                        "kind": "width-1200",
                        "filename": f"{media_id}-w1200.webp",
                        "sha256": f"{index + 10:064x}",
                        "mime_type": "image/webp",
                        "width": 1200,
                        "height": 800,
                        "bytes": 2000 + index,
                    },
                ],
            }
        )
    return {"batch_version": MODULE.BATCH_VERSION, "records": records}


class UenoFamilyBatchTests(unittest.TestCase):
    def build_source(self) -> dict[str, object]:
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path = Path(temporary) / "media-manifest.json"
            manifest_path.write_text(
                json.dumps(fake_manifest(), ensure_ascii=False), encoding="utf-8"
            )
            original_path = MODULE.MEDIA_MANIFEST_PATH
            MODULE.MEDIA_MANIFEST_PATH = manifest_path
            try:
                return MODULE.build_source()
            finally:
                MODULE.MEDIA_MANIFEST_PATH = original_path

    def test_curation_rows_meet_the_photo_and_event_minimum(self) -> None:
        curation_dir = REPO_ROOT / "data" / "curation" / "pandas"
        with (curation_dir / "pandas.csv").open(
            "r", encoding="utf-8-sig", newline=""
        ) as handle:
            pandas = {row["slug"]: row for row in csv.DictReader(handle)}
        with (curation_dir / "events.csv").open(
            "r", encoding="utf-8-sig", newline=""
        ) as handle:
            events = list(csv.DictReader(handle))
        with (curation_dir / "media.csv").open(
            "r", encoding="utf-8-sig", newline=""
        ) as handle:
            media = list(csv.DictReader(handle))

        for slug in TARGET_SLUGS:
            self.assertEqual(pandas[slug]["evidence_status"], "verified")
            self.assertEqual(pandas[slug]["review_status"], "approved")
            direct_events = [
                event
                for event in events
                if event["panda_slug"] == slug
                and event["evidence_status"] == "verified"
                and event["review_status"] == "approved"
            ]
            approved_media = [
                item
                for item in media
                if item["panda_slug"] == slug and item["review_status"] == "approved"
            ]
            self.assertGreaterEqual(len(direct_events), 3, slug)
            self.assertGreaterEqual(len(approved_media), 1, slug)

    def test_builds_fourteen_profile_release_with_complete_ueno_family(self) -> None:
        source = self.build_source()
        self.assertEqual(source["dataset"]["version"], "2026.07.20.2")
        self.assertEqual(source["dataset"]["base_dataset_version"], "2026.07.20.1")
        self.assertEqual(source["dataset"]["core_panda_count"], 14)
        self.assertEqual(len(source["pandas"]), 14)

        target_ids = MODULE.PANDA_IDS
        media_by_panda = {
            item["public"]["panda_id"]: item for item in source["media"]
        }
        for slug, panda_id in target_ids.items():
            panda = next(item for item in source["pandas"] if item["id"] == panda_id)
            self.assertEqual(panda["publication_status"], "published")
            self.assertEqual(
                {content["locale"] for content in panda["public"]["content"]},
                {"zh-CN", "en"},
            )
            self.assertIn(panda_id, media_by_panda, slug)
            self.assertEqual(media_by_panda[panda_id]["public"]["status"], "available")

            public_events = [
                item
                for item in source["events"]
                if panda_id in item["public"]["participants"]
            ]
            self.assertGreaterEqual(len(public_events), 3, slug)

    def test_parentage_comes_from_reviewed_assertions(self) -> None:
        source = self.build_source()
        expected = {
            (MODULE.PANDA_IDS["xiao-xiao"], MODULE.PANDA_IDS["ri-ri"], "father"),
            (MODULE.PANDA_IDS["xiao-xiao"], MODULE.PANDA_IDS["shin-shin"], "mother"),
            (MODULE.PANDA_IDS["lei-lei"], MODULE.PANDA_IDS["ri-ri"], "father"),
            (MODULE.PANDA_IDS["lei-lei"], MODULE.PANDA_IDS["shin-shin"], "mother"),
        }
        actual = {
            (
                item["public"]["child_id"],
                item["public"]["parent_id"],
                item["public"]["role"],
            )
            for item in source["parentage_assertions"]
            if item["public"]["child_id"]
            in {MODULE.PANDA_IDS["xiao-xiao"], MODULE.PANDA_IDS["lei-lei"]}
        }
        self.assertEqual(actual, expected)
        for item in source["parentage_assertions"]:
            if item["public"]["child_id"] in {
                MODULE.PANDA_IDS["xiao-xiao"],
                MODULE.PANDA_IDS["lei-lei"],
            }:
                self.assertEqual(item["public"]["status"], "confirmed")
                self.assertIn("src_tokyo_zoo_ueno_panda_history", item["public"]["source_ids"])

    def test_shared_family_events_are_not_duplicated(self) -> None:
        source = self.build_source()
        ids = [item["id"] for item in source["events"]]
        self.assertEqual(ids.count("event-ueno-pair-arrival-2011"), 1)
        self.assertEqual(ids.count("event-ueno-pair-return-2024"), 1)
        self.assertEqual(ids.count("event-ueno-twins-birth-2021"), 1)
        self.assertEqual(ids.count("event-ueno-twins-named-2021"), 1)
        self.assertEqual(ids.count("event-ueno-twins-return-2026"), 1)

    def test_each_public_collection_has_unique_ids(self) -> None:
        source = self.build_source()
        for collection in (
            "sources",
            "facilities",
            "institutions",
            "places",
            "pandas",
            "facts",
            "parentage_assertions",
            "residencies",
            "events",
            "media",
        ):
            ids = [item["id"] for item in source[collection]]
            self.assertEqual(len(ids), len(set(ids)), collection)

    def test_build_is_deterministic(self) -> None:
        first = json.dumps(self.build_source(), ensure_ascii=False, sort_keys=True)
        second = json.dumps(self.build_source(), ensure_ascii=False, sort_keys=True)
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
