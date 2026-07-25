from __future__ import annotations

import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "collect_local_panda_media.py"
SPEC = importlib.util.spec_from_file_location("collect_local_panda_media", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def candidate(**overrides):
    value = {
        "media_id": "local-media-test-0001",
        "subject_id": "example-panda",
        "subject_label": "Example Panda",
        "source_page_url": "https://example.test/source",
        "asset_url": "https://example.test/image.jpg",
        "credit": "Example Photographer",
        "description": "Example panda portrait.",
        "captured_at": "2026-01-01",
        "identity_confidence": 0.9,
        "rights_label": "All rights reserved",
        "rights_state": "restricted",
        "collection_priority": 1,
        "local_filename": "example-panda.jpg",
        "discovered_at": "2026-07-25",
        "notes": "Local research only.",
    }
    value.update(overrides)
    return value


class LocalPandaMediaCollectorTests(unittest.TestCase):
    def test_repository_candidates_are_valid(self) -> None:
        rows = MODULE.load_jsonl(MODULE.DEFAULT_CANDIDATES)
        MODULE.validate_candidates(rows)
        self.assertGreaterEqual(len(rows), 10)

    def test_restricted_rights_do_not_block_local_download(self) -> None:
        jpeg = b"\xff\xd8\xff" + b"local-image" * 10

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            candidates_path = root / "candidates.jsonl"
            inventory_path = root / "inventory.jsonl"
            files_dir = root / "files"
            candidates_path.write_text(
                json.dumps(candidate(), ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

            entries = MODULE.collect(
                candidates_path=candidates_path,
                inventory_path=inventory_path,
                files_dir=files_dir,
                execute=True,
                opener=lambda _url: io.BytesIO(jpeg),
            )

            self.assertEqual(entries[0]["retrieval_status"], "downloaded")
            self.assertEqual(entries[0]["rights_state"], "restricted")
            self.assertEqual(entries[0]["collection_policy"], "rights-recorded-not-gating")
            self.assertEqual(entries[0]["mime_type"], "image/jpeg")
            self.assertEqual((files_dir / "example-panda.jpg").read_bytes(), jpeg)

    def test_existing_file_is_hashed_without_network(self) -> None:
        jpeg = b"\xff\xd8\xff" + b"existing-image"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            files_dir = root / "files"
            files_dir.mkdir()
            (files_dir / "example-panda.jpg").write_bytes(jpeg)

            entry = MODULE.inventory_entry(
                candidate(),
                files_dir=files_dir,
                execute=True,
                refresh=False,
                opener=lambda _url: self.fail("network should not be called"),
            )

            self.assertEqual(entry["retrieval_status"], "present")
            self.assertEqual(entry["bytes"], len(jpeg))

    def test_path_traversal_filename_is_rejected(self) -> None:
        with self.assertRaisesRegex(MODULE.LocalMediaError, "plain filename"):
            MODULE.validate_candidates([candidate(local_filename="../escape.jpg")])

    def test_strict_failure_mode_is_opt_in(self) -> None:
        parser = MODULE.build_parser()

        self.assertFalse(parser.parse_args([]).strict)
        self.assertTrue(parser.parse_args(["--strict"]).strict)

    def test_prune_orphan_files_only_removes_unreferenced_images(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            files_dir = Path(temporary)
            (files_dir / "keep.jpg").write_bytes(b"keep")
            (files_dir / "remove.png").write_bytes(b"remove")
            (files_dir / "notes.txt").write_text("keep", encoding="utf-8")

            removed = MODULE.prune_orphan_files(
                files_dir,
                [{"local_filename": "keep.jpg"}],
            )

            self.assertEqual(removed, 1)
            self.assertTrue((files_dir / "keep.jpg").exists())
            self.assertFalse((files_dir / "remove.png").exists())
            self.assertTrue((files_dir / "notes.txt").exists())


if __name__ == "__main__":
    unittest.main()
