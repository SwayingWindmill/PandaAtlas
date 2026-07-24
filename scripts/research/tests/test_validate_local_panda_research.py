from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "validate_local_panda_research.py"
SPEC = importlib.util.spec_from_file_location("validate_local_panda_research", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class LocalPandaResearchValidationTests(unittest.TestCase):
    def test_repository_vault_is_valid(self) -> None:
        summary = MODULE.validate_vault()

        self.assertGreaterEqual(summary["sources"], 10)
        self.assertGreaterEqual(summary["records"], 50)
        self.assertGreater(summary["direct_records"], summary["secondary_leads"])
        self.assertGreaterEqual(summary["categories_used"], 10)

    def test_publication_status_must_remain_local_only(self) -> None:
        row = self._valid_record()
        row["publication_status"] = "public"

        errors = MODULE.validate_records(
            [row],
            source_ids={"src-example"},
            categories={"anecdote"},
        )

        self.assertTrue(any("must remain local_only" in error for error in errors))

    def test_secondary_lead_requires_primary_source_review(self) -> None:
        row = self._valid_record()
        row["evidence_level"] = "secondary_lead"
        row["review_status"] = "captured"

        errors = MODULE.validate_records(
            [row],
            source_ids={"src-example"},
            categories={"anecdote"},
        )

        self.assertTrue(
            any("must need a primary source" in error for error in errors)
        )

    @staticmethod
    def _valid_record():
        return {
            "record_id": "lpr-test-0001",
            "subject": {"type": "panda", "id": "example", "label": "Example"},
            "category": "anecdote",
            "predicate": "example_fact",
            "value": "example",
            "source_id": "src-example",
            "source_locator": "example section",
            "source_language": "en",
            "summary_zh": "示例事实。",
            "evidence_level": "direct",
            "confidence": "high",
            "review_status": "captured",
            "publication_status": "local_only",
            "collected_at": "2026-07-24T00:00:00+08:00",
            "tags": ["example"],
            "__path__": "memory.jsonl",
            "__line__": 1,
        }


if __name__ == "__main__":
    unittest.main()
