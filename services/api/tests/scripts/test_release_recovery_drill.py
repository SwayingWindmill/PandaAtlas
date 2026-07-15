from __future__ import annotations

import json
from pathlib import Path

from scripts.run_release_recovery_drill import run_recovery_drill


def test_release_recovery_drill_leaves_reproducible_machine_evidence(
    tmp_path: Path,
) -> None:
    report_path = tmp_path / "recovery-drill.json"

    report = run_recovery_drill(report_path)

    assert report["outcome"] == "passed"
    assert [check["id"] for check in report["checks"]] == [
        "atomic-switch",
        "prior-version-rollback",
        "entity-withdrawal",
        "whole-release-withdrawal",
        "cache-purge",
        "immutable-history",
        "deterministic-d1-rebuild",
    ]
    assert all(check["status"] == "passed" for check in report["checks"])
    assert report["metrics"]["recovery_point_loss_operations"] == 0
    assert report["metrics"]["journal_operations"] == 5
    assert report["metrics"]["replayed_operations"] == 5
    assert report["evidence"]["release_d1_sha256"]["2026.07.14.3"] == report[
        "evidence"
    ]["checked_manifest_d1_sha256"]
    assert report["evidence"]["atomic_failure_stage"] == (
        "after-record-inserts-and-pointer-update"
    )
    assert report["evidence"]["history_sha256_before"] == report["evidence"]["history_sha256_after"]
    assert (
        report["evidence"]["operational_state_sha256"] == report["evidence"]["rebuilt_state_sha256"]
    )
    assert report["evidence"]["cache_entries_after_purge"] == 0
    assert report["evidence"]["append_only_history_sha256_before_mutation"] == report[
        "evidence"
    ]["append_only_history_sha256_after_mutation"]
    assert json.loads(report_path.read_text(encoding="utf-8")) == report
