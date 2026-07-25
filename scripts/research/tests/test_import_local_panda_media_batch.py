from __future__ import annotations

import base64
import gzip
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts" / "research"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
MODULE_PATH = SCRIPT_DIR / "import_local_panda_media_batch.py"
SPEC = importlib.util.spec_from_file_location("import_local_panda_media_batch", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def candidate(media_id: str, asset_url: str, filename: str) -> dict[str, object]:
    return {
        "media_id": media_id,
        "subject_id": "xiao-qi-ji",
        "subject_label": "Xiao Qi Ji",
        "source_page_url": "https://example.test/source",
        "asset_url": asset_url,
        "credit": "Example credit",
        "description": "Example official panda photo.",
        "captured_at": "2021-01-01",
        "identity_confidence": 0.99,
        "rights_label": "Restricted",
        "rights_state": "restricted",
        "collection_priority": 1,
        "local_filename": filename,
        "discovered_at": "2026-07-25",
        "notes": "Local research only.",
    }


class ImportLocalPandaMediaBatchTests(unittest.TestCase):
    def test_gzip_base64_jsonl_can_be_loaded(self) -> None:
        row = candidate("local-media-one", "https://example.test/one.jpg", "one.jpg")
        encoded = base64.b64encode(
            gzip.compress((json.dumps(row) + "\n").encode("utf-8"))
        ).decode("ascii")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "batch.jsonl.gz.b64"
            path.write_text(encoded, encoding="ascii")
            rows = MODULE.load_gzip_base64_jsonl(path)
        self.assertEqual(rows[0]["media_id"], "local-media-one")

    def test_merge_adds_new_candidate(self) -> None:
        existing = [candidate("local-media-one", "https://example.test/one.jpg", "one.jpg")]
        incoming = [candidate("local-media-two", "https://example.test/two.jpg", "two.jpg")]
        merged, added, replaced = MODULE.merge_candidates(existing, incoming)
        self.assertEqual(len(merged), 2)
        self.assertEqual(added, 1)
        self.assertEqual(replaced, 0)

    def test_merge_reconciles_same_asset_url(self) -> None:
        existing = [candidate("local-media-one", "https://example.test/one.jpg", "one.jpg")]
        replacement = candidate("local-media-new-id", "https://example.test/one.jpg", "one.jpg")
        replacement["description"] = "Updated description"
        merged, added, replaced = MODULE.merge_candidates(existing, [replacement])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["media_id"], "local-media-one")
        self.assertEqual(merged[0]["description"], "Updated description")
        self.assertEqual(added, 0)
        self.assertEqual(replaced, 1)


if __name__ == "__main__":
    unittest.main()
