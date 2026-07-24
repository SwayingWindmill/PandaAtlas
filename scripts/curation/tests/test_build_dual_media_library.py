from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "build_dual_media_library.py"
SPEC = importlib.util.spec_from_file_location("build_dual_media_library", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_overrides(path: Path, overrides: list[dict[str, str]]) -> None:
    path.write_text(
        json.dumps(
            {"schema_version": 1, "reviewed_at": "2026-07-24", "overrides": overrides},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


class DualMediaLibraryTests(unittest.TestCase):
    def test_current_release_builds_separate_collection_and_open_libraries(self) -> None:
        result = MODULE.build()
        summary = result.coverage["summary"]
        self.assertEqual(summary["panda_count"], 813)
        self.assertEqual(summary["pandas_with_candidates"], 14)
        self.assertEqual(summary["pandas_needing_discovery"], 799)
        self.assertEqual(summary["private_collection_main_images"], 14)
        self.assertEqual(summary["public_open_main_images"], 9)
        self.assertEqual(summary["restricted_candidates"], 4)
        self.assertEqual(summary["low_identity_candidates"], 3)
        self.assertEqual(result.candidates["candidate_count"], 14)

        private_slugs = {
            item["panda_slug"]
            for item in result.selections["scopes"]["private_collection"]["selections"]
        }
        public_slugs = {
            item["panda_slug"]
            for item in result.selections["scopes"]["public_open"]["selections"]
        }
        self.assertIn("qing-bao", private_slugs)
        self.assertNotIn("qing-bao", public_slugs)
        self.assertIn("bao-xin", private_slugs)
        self.assertNotIn("bao-xin", public_slugs)
        self.assertIn("zhen-xi", private_slugs)
        self.assertNotIn("zhen-xi", public_slugs)

    def test_open_library_contains_only_open_high_confidence_candidates(self) -> None:
        result = MODULE.build()
        candidates = {
            item["candidate_id"]: item for item in result.candidates["candidates"]
        }
        selections = result.selections["scopes"]["public_open"]["selections"]
        for selection in selections:
            candidate = candidates[selection["main_candidate_id"]]
            self.assertIn(candidate["rights_state"], MODULE.OPEN_RIGHTS_STATES)
            self.assertEqual(candidate["review_state"], "approved")
            self.assertGreaterEqual(candidate["identity_confidence"], 0.85)
            self.assertGreaterEqual(candidate["rights_confidence"], 0.90)
            self.assertFalse(candidate["withdrawn"])
            self.assertTrue(
                candidate["scope_eligibility"]["public_open"]["eligible"]
            )

    def test_probable_and_cohort_candidates_remain_collection_only(self) -> None:
        result = MODULE.build()
        candidates = {
            item["panda_slug"]: item for item in result.candidates["candidates"]
        }
        qing_bao = candidates["qing-bao"]
        self.assertEqual(qing_bao["rights_state"], "open_license")
        self.assertEqual(qing_bao["identity_confidence"], 0.65)
        self.assertTrue(
            qing_bao["scope_eligibility"]["private_collection"]["eligible"]
        )
        self.assertFalse(qing_bao["scope_eligibility"]["public_open"]["eligible"])

        for slug in (
            "qing-qing-chengdu-2017-07-26",
            "xiao-xin-chengdu-2017",
        ):
            candidate = candidates[slug]
            self.assertEqual(candidate["identity_confidence"], 0.55)
            self.assertEqual(candidate["rights_state"], "restricted")
            self.assertTrue(
                candidate["scope_eligibility"]["private_collection"]["eligible"]
            )
            self.assertFalse(
                candidate["scope_eligibility"]["public_open"]["eligible"]
            )

    def test_override_cannot_force_restricted_candidate_into_open_library(self) -> None:
        initial = MODULE.build()
        candidate = next(
            item
            for item in initial.candidates["candidates"]
            if item["panda_slug"] == "bao-xin"
        )
        with tempfile.TemporaryDirectory() as temporary:
            overrides = Path(temporary) / "overrides.json"
            write_overrides(
                overrides,
                [
                    {
                        "action": "select",
                        "scope": "public_open",
                        "candidate_id": candidate["candidate_id"],
                        "reason": "invalid-test-override",
                    }
                ],
            )
            with self.assertRaisesRegex(
                MODULE.MediaLibraryError, "cannot select ineligible candidate"
            ):
                MODULE.build(overrides_path=overrides)

    def test_withdrawal_removes_candidate_from_both_libraries(self) -> None:
        initial = MODULE.build()
        candidate = next(
            item
            for item in initial.candidates["candidates"]
            if item["panda_slug"] == "lun-lun"
        )
        with tempfile.TemporaryDirectory() as temporary:
            overrides = Path(temporary) / "overrides.json"
            write_overrides(
                overrides,
                [
                    {
                        "action": "withdraw",
                        "scope": "private_collection",
                        "candidate_id": candidate["candidate_id"],
                        "reason": "rights-review",
                    }
                ],
            )
            result = MODULE.build(overrides_path=overrides)

        withdrawn = next(
            item
            for item in result.candidates["candidates"]
            if item["candidate_id"] == candidate["candidate_id"]
        )
        self.assertTrue(withdrawn["withdrawn"])
        self.assertEqual(withdrawn["withdrawal_reason"], "rights-review")
        for scope in ("private_collection", "public_open"):
            selected = {
                item["panda_slug"]
                for item in result.selections["scopes"][scope]["selections"]
            }
            self.assertNotIn("lun-lun", selected)

    def test_duplicate_delivery_is_collapsed_and_selection_is_deterministic(self) -> None:
        def candidate(candidate_id: str, score: float) -> dict:
            return {
                "candidate_id": candidate_id,
                "panda_slug": "test-panda",
                "duplicate_group_id": "delivery-sha256-same",
                "scope_eligibility": {
                    "private_collection": {"eligible": True, "score": score}
                },
            }

        candidates = [candidate("media-candidate-b", 0.80), candidate("media-candidate-a", 0.90)]
        first = MODULE.build_scope_selection(candidates, "private_collection", {})
        second = MODULE.build_scope_selection(
            list(reversed(candidates)), "private_collection", {}
        )
        self.assertEqual(first, second)
        self.assertEqual(first[0]["main_candidate_id"], "media-candidate-a")
        self.assertEqual(first[0]["gallery_candidate_ids"], ["media-candidate-a"])

    def test_build_and_generated_files_are_reproducible(self) -> None:
        first = MODULE.build()
        second = MODULE.build()
        self.assertEqual(first, second)

        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "2026.07.24.2"
            MODULE.install_atomically(output, first)
            for filename, payload in {
                "candidates.json": first.candidates,
                "selections.json": first.selections,
                "coverage.json": first.coverage,
                "manifest.json": first.manifest,
            }.items():
                self.assertEqual(
                    (output / filename).read_text(encoding="utf-8"),
                    MODULE.pretty_json(payload),
                )


if __name__ == "__main__":
    unittest.main()
