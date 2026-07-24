from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "build_local_commons_media_batch.py"
SPEC = importlib.util.spec_from_file_location("build_local_commons_media_batch", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class LocalCommonsMediaBatchTests(unittest.TestCase):
    def test_covered_subject_ids_ignore_unresolved_and_groups(self) -> None:
        candidates = [
            {"subject_id": "mei-xiang"},
            {"subject_id": "group-example"},
            {"subject_id": "unresolved-commons"},
        ]

        self.assertEqual(MODULE.covered_subject_ids(candidates), {"mei-xiang"})

    def test_select_tasks_uses_one_uncovered_task_per_panda(self) -> None:
        queue = {
            "tasks": [
                {
                    "priority": 0,
                    "variant_order": 0,
                    "panda_slug": "covered",
                    "task_id": "task-covered",
                },
                {
                    "priority": 0,
                    "variant_order": 0,
                    "panda_slug": "alpha",
                    "task_id": "task-alpha-en",
                },
                {
                    "priority": 0,
                    "variant_order": 1,
                    "panda_slug": "alpha",
                    "task_id": "task-alpha-zh",
                },
                {
                    "priority": 1,
                    "variant_order": 0,
                    "panda_slug": "beta",
                    "task_id": "task-beta",
                },
            ]
        }

        selected = MODULE.select_tasks(
            queue,
            covered_subjects={"covered"},
            processed_tasks={"task-alpha-zh"},
            task_limit=2,
        )

        self.assertEqual(
            [task["task_id"] for task in selected],
            ["task-alpha-en", "task-beta"],
        )

    def test_task_limit_must_be_positive(self) -> None:
        with self.assertRaisesRegex(MODULE.LocalCommonsBatchError, "positive"):
            MODULE.select_tasks(
                {"tasks": []},
                covered_subjects=set(),
                processed_tasks=set(),
                task_limit=0,
            )

    def test_processed_task_ids_include_completed_and_failed_tasks(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "commons-batch-001-results.json").write_text(
                '{"tasks":[{"task":{"task_id":"done-task"}}],"failures":[{"task_id":"failed-task"}]}',
                encoding="utf-8",
            )

            self.assertEqual(
                MODULE.processed_task_ids(root),
                {"done-task", "failed-task"},
            )


if __name__ == "__main__":
    unittest.main()
