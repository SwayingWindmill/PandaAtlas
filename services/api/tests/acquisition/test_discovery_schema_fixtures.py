from __future__ import annotations

import json
from pathlib import Path

from app.acquisition.discovery import (
    DiscoveryRunResult,
    DiscoveryRunState,
    MaterialChangeState,
)

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-discovery-intake.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-discovery-intake-fixtures" / "v1"


def test_checked_in_discovery_schema_matches_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    assert checked_in == DiscoveryRunResult.model_json_schema()


def test_discovery_acceptance_fixtures_validate_and_cover_required_states() -> None:
    expected_names = {
        "completed.valid.json",
        "incremental.valid.json",
        "stopped.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))

    assert {path.name for path in fixture_paths} == expected_names

    fixtures = {
        path.name: DiscoveryRunResult.model_validate_json(path.read_text(encoding="utf-8"))
        for path in fixture_paths
    }
    completed = fixtures["completed.valid.json"]
    incremental = fixtures["incremental.valid.json"]
    stopped = fixtures["stopped.valid.json"]

    assert completed.manifest.state is DiscoveryRunState.COMPLETED
    assert completed.manifest.summary.languages == ("en", "ja", "ko", "zh-CN")
    assert completed.manifest.summary.unknown_source_count == 2
    assert completed.manifest.summary.intake_candidate_count == 2

    assert {entry.change_state for entry in incremental.manifest.entries} == {
        MaterialChangeState.NEW,
        MaterialChangeState.CHANGED,
        MaterialChangeState.REMOVED,
        MaterialChangeState.UNCHANGED,
    }
    assert incremental.manifest.summary.intake_candidate_count == 2

    assert stopped.manifest.state is DiscoveryRunState.STOPPED
    assert stopped.manifest.summary.stop_count == 1
    assert stopped.manifest.entries == ()
