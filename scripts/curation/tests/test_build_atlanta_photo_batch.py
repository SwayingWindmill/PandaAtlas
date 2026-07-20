from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "curation" / "build_atlanta_photo_batch.py"
SPEC = importlib.util.spec_from_file_location("build_atlanta_photo_batch", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class AtlantaPhotoBatchTests(unittest.TestCase):
    def test_batch_preserves_golden_baseline_and_adds_three_complete_pandas(self) -> None:
        golden = json.loads(MODULE.GOLDEN_PATH.read_text(encoding="utf-8"))
        source = MODULE.build_source()

        self.assertEqual(len(golden["pandas"]), 7)
        self.assertEqual(golden["dataset"]["version"], "2026.07.18.1")
        self.assertEqual(source["dataset"]["version"], "2026.07.20.1")
        self.assertEqual(source["dataset"]["public_schema_version"], "1.2.0")
        self.assertEqual(len(source["pandas"]), 10)
        self.assertEqual(
            set(source["dataset"]["expansion_panda_ids"]), set(MODULE.PANDA_IDS.values())
        )

        published_events = [
            item for item in source["events"] if item["publication_status"] == "published"
        ]
        available_media = [
            item
            for item in source["media"]
            if item["publication_status"] == "published"
            and item["public"].get("status") == "available"
        ]
        for slug, panda_id in MODULE.PANDA_IDS.items():
            panda = next(item for item in source["pandas"] if item["id"] == panda_id)
            self.assertEqual(panda["publication_status"], "published")
            approved_locales = {
                item["locale"]
                for item in panda["public"]["content"]
                if item["translation_status"] == "approved"
            }
            self.assertEqual(approved_locales, {"zh-CN", "en"})
            self.assertGreaterEqual(
                sum(panda_id in item["public"]["participants"] for item in published_events),
                3,
                slug,
            )
            self.assertEqual(
                sum(item["public"]["panda_id"] == panda_id for item in available_media),
                1,
                slug,
            )
            current = [
                item
                for item in source["residencies"]
                if item["publication_status"] == "published"
                and item["public"]["panda_id"] == panda_id
                and item["public"]["residency_type"] == "primary"
                and item["public"]["end_date"] is None
            ]
            self.assertEqual(len(current), 1, slug)
            self.assertEqual(current[0]["public"]["last_verified_at"], "2026-07-20")

    def test_public_media_uses_generated_r2_derivatives_without_internal_paths(self) -> None:
        source = MODULE.build_source()
        media = [item for item in source["media"] if item["public"].get("status") == "available"]
        self.assertEqual(len(media), 3)
        for item in media:
            public = item["public"]
            self.assertTrue(public["url"].startswith(MODULE.MEDIA_BASE_URL + "/"))
            self.assertTrue(public["url"].endswith("-w1200.webp"))
            self.assertEqual([asset["width"] for asset in public["derivatives"]], [480, 1200])
            self.assertNotIn("path", public)
            self.assertNotIn("asset", public)
            self.assertNotIn("original", public)
            self.assertEqual(public["rights"], "CC BY-SA 4.0")

    def test_tracked_source_is_reproducible(self) -> None:
        self.assertEqual(MODULE.OUTPUT_PATH.read_text(encoding="utf-8"), MODULE.serialized_source())


if __name__ == "__main__":
    unittest.main()
