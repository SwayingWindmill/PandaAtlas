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
MODULE_PATH = ROOT / "scripts" / "research" / "runners" / "import_local_panda_research_batch.py"
SPEC = importlib.util.spec_from_file_location("import_local_panda_research_batch", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ImportLocalPandaResearchBatchTests(unittest.TestCase):
    def test_secondary_lead_review_status_is_normalized(self) -> None:
        records = [
            {
                "record_id": "lpr-test-1",
                "evidence_level": "secondary_lead",
                "review_status": "captured",
                "publication_status": "published",
            }
        ]

        normalized, fixes = MODULE.normalize_records(records)

        self.assertEqual(fixes, 1)
        self.assertEqual(normalized[0]["review_status"], "needs_primary_source")
        self.assertEqual(normalized[0]["publication_status"], "local_only")
        self.assertEqual(records[0]["review_status"], "captured")

    def test_merge_sources_preserves_order_and_replaces_matching_ids(self) -> None:
        existing = [
            {"source_id": "src-a", "title": "old"},
            {"source_id": "src-b", "title": "keep"},
        ]
        incoming = [
            {"source_id": "src-a", "title": "new"},
            {"source_id": "src-c", "title": "add"},
        ]

        merged, added, replaced = MODULE.merge_sources(existing, incoming)

        self.assertEqual([row["source_id"] for row in merged], ["src-a", "src-b", "src-c"])
        self.assertEqual(merged[0]["title"], "new")
        self.assertEqual(added, 1)
        self.assertEqual(replaced, 1)

    def test_load_batch_requires_object_arrays(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "batch.json"
            path.write_text(json.dumps({"sources": {}, "records": []}), encoding="utf-8")
            with self.assertRaises(MODULE.BatchImportError):
                MODULE.load_batch(path)

    def test_gzip_base64_batch_can_be_loaded(self) -> None:
        payload = {"sources": [{"source_id": "src-test"}], "records": [{"record_id": "lpr-test"}]}
        encoded = base64.b64encode(gzip.compress(json.dumps(payload).encode("utf-8"))).decode("ascii")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "batch.json.gz.b64"
            path.write_text(encoded, encoding="ascii")
            sources, records = MODULE.load_batch_gzip_base64(path)
        self.assertEqual(sources[0]["source_id"], "src-test")
        self.assertEqual(records[0]["record_id"], "lpr-test")

    def test_duplicate_record_ids_are_rejected(self) -> None:
        with self.assertRaises(MODULE.BatchImportError):
            MODULE.ensure_unique_record_ids(
                [
                    {"record_id": "lpr-duplicate"},
                    {"record_id": "lpr-duplicate"},
                ]
            )


if __name__ == "__main__":
    unittest.main()
