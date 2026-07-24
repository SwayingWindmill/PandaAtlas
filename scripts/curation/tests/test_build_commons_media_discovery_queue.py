from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = (
    REPO_ROOT / "scripts" / "curation" / "build_commons_media_discovery_queue.py"
)
SPEC = importlib.util.spec_from_file_location(
    "build_commons_media_discovery_queue", MODULE_PATH
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class CommonsMediaDiscoveryQueueTests(unittest.TestCase):
    def test_builds_complete_bounded_queue_and_first_public_cohort(self) -> None:
        payloads = MODULE.build()
        queue = payloads["queue"]
        cohort = payloads["cohort"]

        self.assertEqual(queue["summary"]["pandas_needing_discovery"], 799)
        self.assertEqual(
            queue["summary"]["public_release_pandas_needing_discovery"], 24
        )
        self.assertEqual(queue["summary"]["task_count"], 1057)
        self.assertEqual(queue["summary"]["english_tasks"], 799)
        self.assertEqual(queue["summary"]["chinese_tasks"], 258)
        self.assertEqual(cohort["task_count"], 5)
        self.assertEqual(
            [task["panda_slug"] for task in cohort["tasks"]],
            list(MODULE.FIRST_COHORT_SLUGS),
        )
        self.assertTrue(
            all(task["query"].endswith(" Smithsonian panda") for task in cohort["tasks"])
        )
        self.assertTrue(all(task["max_results"] == 5 for task in queue["tasks"]))
        self.assertTrue(all(task["namespace"] == 6 for task in queue["tasks"]))
        self.assertTrue(all(task["allow_continuation"] is False for task in queue["tasks"]))
        self.assertTrue(all(task["download_original"] is False for task in queue["tasks"]))
        self.assertEqual(queue["policy"]["publication_write_targets"], [])

    def test_queue_is_deterministic_and_atomically_installable(self) -> None:
        first = MODULE.build()
        second = MODULE.build()
        self.assertEqual(first, second)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "discovery"
            MODULE.install_atomically(output, first)
            self.assertEqual(
                (output / "commons-queue.json").read_text(encoding="utf-8"),
                MODULE.pretty_json(first["queue"]),
            )
            self.assertEqual(
                (output / "commons-first-public-five.json").read_text(
                    encoding="utf-8"
                ),
                MODULE.pretty_json(first["cohort"]),
            )

    def test_task_ids_change_when_reviewed_context_changes(self) -> None:
        row = {"name_en": "Bao Bao", "name_zh": "宝宝"}
        contextual = MODULE.query_variants("bao-bao", row)[0]
        generic = MODULE.query_variants("unrelated-slug", row)[0]
        self.assertNotEqual(contextual["query"], generic["query"])
        self.assertNotEqual(
            MODULE.task_id("bao-bao", contextual["query"]),
            MODULE.task_id("bao-bao", generic["query"]),
        )


if __name__ == "__main__":
    unittest.main()
