from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = (
    REPO_ROOT / "scripts" / "curation" / "build_smithsonian_commons_media_batch.py"
)
SPEC = importlib.util.spec_from_file_location(
    "build_smithsonian_commons_media_batch", MODULE_PATH
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class SmithsonianCommonsMediaBatchTests(unittest.TestCase):
    def test_discovery_allowlist_is_exact_and_reviewed(self) -> None:
        candidates = MODULE.discovery_candidates()
        self.assertEqual(set(candidates), set(MODULE.CANDIDATES))
        self.assertEqual(len(candidates), 6)
        primary = {
            candidate_id
            for candidate_id, expected in MODULE.CANDIDATES.items()
            if expected["curator_role"] == "primary"
        }
        gallery = set(candidates) - primary
        self.assertEqual(
            primary,
            {
                "commons-candidate-73ee162326e52f8d7f6bb4aa",
                "commons-candidate-7c99cc1fb00e3519f119e770",
            },
        )
        self.assertEqual(len(gallery), 4)
        self.assertTrue(
            all(candidate["identity_confidence"] >= 0.85 for candidate in candidates.values())
        )
        self.assertTrue(
            all(candidate["rights_confidence"] >= 0.90 for candidate in candidates.values())
        )

    def test_archived_processor_and_media_manifests_cover_all_six_candidates(self) -> None:
        processor = MODULE.read_json(MODULE.PROCESSOR_MANIFEST_PATH)
        records = MODULE.processor_records(processor)
        candidates = MODULE.discovery_candidates()
        media = MODULE.build_media_manifest(records, candidates)
        self.assertEqual(media["record_count"], 6)
        self.assertEqual(
            {record["candidate_id"] for record in media["records"]},
            set(MODULE.CANDIDATES),
        )
        self.assertTrue(all(len(record["derivatives"]) == 2 for record in media["records"]))
        self.assertTrue(
            all(
                {derivative["kind"] for derivative in record["derivatives"]}
                == {"width-480", "width-1200"}
                for record in media["records"]
            )
        )

    def test_duplicate_review_retains_six_distinct_originals(self) -> None:
        duplicate_review = MODULE.read_json(MODULE.DUPLICATE_REVIEW_PATH)
        self.assertEqual(duplicate_review["candidate_count"], 6)
        self.assertEqual(len(duplicate_review["pairs"]), 15)
        self.assertEqual(duplicate_review["exact_duplicate_groups"], [])
        self.assertEqual(duplicate_review["near_duplicate_pairs"], [])
        self.assertEqual(duplicate_review["outcome"], "passed")
        self.assertGreater(
            min(pair["perceptual_distance"] for pair in duplicate_review["pairs"]),
            duplicate_review["near_duplicate_distance_threshold"],
        )

    def test_source_preserves_38_pandas_and_replaces_target_empty_states(self) -> None:
        source = MODULE.read_json(MODULE.OUTPUT_PATH)
        self.assertEqual(source["dataset"]["version"], MODULE.BATCH_VERSION)
        self.assertEqual(source["dataset"]["base_dataset_version"], MODULE.BASE_VERSION)
        self.assertEqual(len(source["pandas"]), 38)
        pandas_by_slug = {
            panda["public"]["canonical_slug"]: panda["id"] for panda in source["pandas"]
        }
        target_ids = {pandas_by_slug["mei-xiang"], pandas_by_slug["xiao-qi-ji"]}
        target_media = [
            media
            for media in source["media"]
            if media.get("public", {}).get("panda_id") in target_ids
        ]
        self.assertEqual(len(target_media), 6)
        self.assertEqual(
            [media["public"]["presentation_role"] for media in target_media].count("primary"),
            2,
        )
        self.assertEqual(
            [media["public"]["presentation_role"] for media in target_media].count("gallery"),
            4,
        )
        self.assertTrue(
            all(media["public"]["rights"].startswith("CC BY") for media in target_media)
        )
        self.assertTrue(
            all(media["public"].get("status") == "available" for media in target_media)
        )
        self.assertFalse(
            any(
                media["id"] in {"media-mei-xiang-none", "media-xiao-qi-ji-none"}
                for media in source["media"]
            )
        )

    def test_generated_batch_is_reproducible(self) -> None:
        MODULE.check_outputs()
        integrity = json.loads(MODULE.SOURCE_INTEGRITY_PATH.read_text(encoding="utf-8"))
        self.assertEqual(integrity["candidate_ids"], sorted(MODULE.CANDIDATES))
        self.assertEqual(integrity["publication_write_targets"], [])
        self.assertEqual(integrity["review_state"], "approved-for-public-release-build")


if __name__ == "__main__":
    unittest.main()
