from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "runners" / "run_local_commons_media_discovery.py"
SPEC = importlib.util.spec_from_file_location("run_local_commons_media_discovery", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def task(task_id: str, slug: str) -> dict[str, object]:
    return {
        "adapter_id": "wikimedia-commons-media-discovery",
        "allow_continuation": False,
        "download_original": False,
        "max_results": 5,
        "name_en": slug,
        "name_zh": "示例",
        "namespace": 6,
        "panda_slug": slug,
        "priority": 0,
        "query": f'"{slug}" giant panda',
        "query_basis": "canonical-english-name",
        "query_locale": "en",
        "source_id": "wikimedia-commons-action-api",
        "state": "pending",
        "task_id": task_id,
        "variant_order": 0,
    }


class LocalCommonsDiscoveryRunnerTests(unittest.TestCase):
    def test_failed_network_tasks_are_recorded_without_aborting_batch(self) -> None:
        cohort = {
            "schema_version": 1,
            "cohort_id": "test-cohort",
            "dataset_release_version": "test-release",
            "generated_at": "2026-07-25T00:00:00+09:00",
            "minimum_request_interval_seconds": 0,
            "publication_write_targets": [],
            "task_count": 2,
            "tasks": [task("task-1", "alpha"), task("task-2", "beta")],
        }

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result = MODULE.run_batch(
                cohort,
                output_path=root / "results.json",
                fixture_dir=root / "fixtures",
                fetcher=lambda _task: (_ for _ in ()).throw(URLError("offline")),
                sleeper=lambda _seconds: None,
            )

        self.assertEqual(result["outcome"], "partial")
        self.assertEqual(result["completed_task_count"], 0)
        self.assertEqual(result["failed_task_count"], 2)
        self.assertEqual(result["candidate_count"], 0)

    def test_cohort_cannot_declare_publication_writes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "cohort.json"
            path.write_text(
                '{"schema_version":1,"task_count":1,"tasks":[{}],"publication_write_targets":["public"]}',
                encoding="utf-8",
            )

            with self.assertRaisesRegex(MODULE.LocalCommonsDiscoveryError, "publication"):
                MODULE.load_cohort(path)


if __name__ == "__main__":
    unittest.main()
