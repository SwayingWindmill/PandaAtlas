from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "import_local_panda_media_candidates.py"
SPEC = importlib.util.spec_from_file_location("import_local_panda_media_candidates", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class LocalPandaMediaCandidateImportTests(unittest.TestCase):
    def test_restricted_candidate_is_imported(self) -> None:
        source = {
            "candidate_id": "media-candidate-example",
            "panda_slug": "example-panda",
            "asset_url": "https://example.test/example.jpg",
            "source_url": "https://example.test/source",
            "credit": "Example credit",
            "rights_label": "All rights reserved",
            "rights_state": "restricted",
            "identity_confidence": 0.8,
            "review_state": "collection_only",
            "alt_en": "Example panda image.",
            "captured_at": None,
        }

        candidate = MODULE.candidate_from_release(
            source,
            labels={"example-panda": "Example Panda"},
            release_version="2026.07.24.3",
            discovered_at="2026-07-25",
        )

        self.assertEqual(candidate["rights_state"], "restricted")
        self.assertEqual(candidate["collection_priority"], 2)
        self.assertEqual(candidate["captured_at"], "unknown")
        self.assertIn("never gates local ingestion", candidate["notes"])

    def test_duplicate_asset_url_is_not_added_twice(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            release_dir = root / "release"
            release_dir.mkdir()
            output = root / "candidates.jsonl"
            asset_url = "https://example.test/example.jpg"
            output.write_text(
                json.dumps(
                    {
                        "media_id": "local-media-existing",
                        "asset_url": asset_url,
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            (release_dir / "candidates.json").write_text(
                json.dumps(
                    {
                        "dataset_release_version": "test-release",
                        "candidates": [
                            {
                                "candidate_id": "media-candidate-example",
                                "panda_slug": "example-panda",
                                "asset_url": asset_url,
                                "source_url": "https://example.test/source",
                                "credit": "Example credit",
                                "rights_label": "restricted",
                                "rights_state": "restricted",
                                "identity_confidence": 0.8,
                                "review_state": "collection_only",
                                "alt_en": "Example panda image.",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            original_loader = MODULE.load_panda_labels
            MODULE.load_panda_labels = lambda: {"example-panda": "Example Panda"}
            try:
                summary = MODULE.import_release_candidates(
                    release_dir=release_dir,
                    output_path=output,
                    discovered_at="2026-07-25",
                )
            finally:
                MODULE.load_panda_labels = original_loader

            self.assertEqual(summary["added_candidates"], 0)
            self.assertEqual(summary["skipped_duplicates"], 1)
            self.assertEqual(summary["total_candidates"], 1)

    def test_latest_release_can_be_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "2026.07.24.2").mkdir()
            latest = root / "2026.07.24.3"
            latest.mkdir()

            self.assertEqual(MODULE.latest_release_dir(root), latest)

    def test_commons_subject_resolution_uses_description_not_search_target(self) -> None:
        source = {
            "panda_slug": "bao-bao",
            "file_title": "File:Mei Xiang portrait.jpg",
            "description": "Giant panda Mei Xiang at the Smithsonian National Zoo.",
            "categories": ["Mei Xiang (panda)"],
        }
        alias_index = {
            "bao bao": {"bao-bao"},
            "mei xiang": {"mei-xiang"},
        }

        self.assertEqual(
            MODULE.resolve_commons_subjects(source, alias_index=alias_index),
            ["mei-xiang"],
        )

    def test_commons_video_is_skipped(self) -> None:
        source = {
            "mime": "video/webm",
            "original_url": "https://example.test/panda.webm",
            "description_url": "https://example.test/source",
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={},
                discovered_at="2026-07-25",
            )
        )


if __name__ == "__main__":
    unittest.main()
