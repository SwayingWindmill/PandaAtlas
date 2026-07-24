from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "build_chengdu_profile_depth_batch.py"
SPEC = importlib.util.spec_from_file_location("build_chengdu_profile_depth_batch", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ChengduProfileDepthBatchTests(unittest.TestCase):
    def test_builds_deep_profiles_lineage_events_and_media(self) -> None:
        source, media_manifest = MODULE.build()
        self.assertEqual(source["dataset"]["version"], "2026.07.24.2")
        self.assertEqual(source["dataset"]["base_dataset_version"], "2026.07.24.1")
        self.assertEqual(len(source["pandas"]), 38)
        self.assertEqual(len(media_manifest["records"]), 4)

        pandas = {
            item["public"]["canonical_slug"]: item for item in source["pandas"]
        }
        assertions = {
            item["public"]["child_id"]: item for item in source["parentage_assertions"]
        }
        media = {
            item["public"].get("panda_id"): item for item in source["media"]
        }
        events_by_panda: dict[str, set[str]] = {}
        for item in source["events"]:
            for participant in item["public"].get("participants", []):
                events_by_panda.setdefault(participant, set()).add(item["public"]["event_type"])

        for slug, config in MODULE.CHILDREN.items():
            panda_id = pandas[slug]["id"]
            mother_id = pandas[config["mother_slug"]]["id"]
            self.assertEqual(assertions[panda_id]["public"]["parent_id"], mother_id)
            self.assertEqual(assertions[panda_id]["public"]["status"], "confirmed")
            self.assertEqual(media[panda_id]["public"]["status"], "available")
            self.assertEqual(len(media[panda_id]["public"]["derivatives"]), 2)
            self.assertIn("birth", events_by_panda[panda_id])
            self.assertIn("public_debut", events_by_panda[panda_id])

        zhen_xi_id = pandas["zhen-xi"]["id"]
        self.assertIn("observation", events_by_panda[zhen_xi_id])
        self.assertIn("初生体重168克", pandas["zhen-xi"]["public"]["content"][0]["summary"])

    def test_maternal_stubs_do_not_promote_secondary_profile_facts(self) -> None:
        source, _ = MODULE.build()
        pandas = {
            item["public"]["canonical_slug"]: item for item in source["pandas"]
        }
        parent_ids = {pandas[slug]["id"] for slug in MODULE.PARENTS}
        fact_subject_ids = {item["public"]["subject_id"] for item in source["facts"]}
        self.assertTrue(parent_ids.isdisjoint(fact_subject_ids))
        for slug in MODULE.PARENTS:
            public = pandas[slug]["public"]
            self.assertEqual(public["record_tier"], "identity_first_pass")
            self.assertEqual(public["life_status"], "unknown")

    def test_build_is_deterministic(self) -> None:
        first_source, first_media = MODULE.build()
        second_source, second_media = MODULE.build()
        self.assertEqual(MODULE.canonical_json(first_source), MODULE.canonical_json(second_source))
        self.assertEqual(MODULE.canonical_json(first_media), MODULE.canonical_json(second_media))


if __name__ == "__main__":
    unittest.main()
