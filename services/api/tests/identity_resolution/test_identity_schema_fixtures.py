from __future__ import annotations

import json
from pathlib import Path

from app.identity_resolution import (
    IdentityChangeKind,
    IdentityDecisionKind,
    IdentityResolutionPackage,
    IdentityRiskLevel,
)
from app.knowledge.contracts import IdentityResolutionState

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-identity-resolution.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-identity-resolution-fixtures" / "v1"


def test_checked_in_identity_schema_matches_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    assert checked_in == IdentityResolutionPackage.model_json_schema()


def test_identity_acceptance_fixtures_validate_required_scenarios() -> None:
    expected_names = {
        "alias.valid.json",
        "changed-name.valid.json",
        "exact.valid.json",
        "merge.valid.json",
        "same-name-different-panda.valid.json",
        "split.valid.json",
        "translated-name.valid.json",
        "unresolved-name-only.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))
    assert {path.name for path in fixture_paths} == expected_names

    fixtures = {
        path.name: IdentityResolutionPackage.model_validate_json(path.read_text(encoding="utf-8"))
        for path in fixture_paths
    }
    for name in (
        "alias.valid.json",
        "changed-name.valid.json",
        "exact.valid.json",
        "translated-name.valid.json",
    ):
        decision = fixtures[name].batch.decisions[0]
        assert decision.kind is IdentityDecisionKind.MERGE
        assert decision.public_eligible
        assert fixtures[name].batch.validation_candidates[0].resolution.state is (
            IdentityResolutionState.MATCHED
        )

    same_name = fixtures["same-name-different-panda.valid.json"].batch.decisions[0]
    assert same_name.kind is IdentityDecisionKind.CREATE
    assert same_name.public_eligible
    assert same_name.scores[0].hard_conflicts == (
        "birth-date-conflict",
        "sex-conflict",
    )

    unresolved = fixtures["unresolved-name-only.valid.json"].batch
    assert unresolved.decisions[0].kind is IdentityDecisionKind.UNRESOLVED
    assert unresolved.validation_candidates == ()
    assert unresolved.public_candidate_record_ids == ()

    merge = fixtures["merge.valid.json"].changesets[0]
    split = fixtures["split.valid.json"].changesets[0]
    assert merge.kind is IdentityChangeKind.MERGE
    assert split.kind is IdentityChangeKind.SPLIT
    assert merge.audit.risk is IdentityRiskLevel.HIGH
    assert split.audit.risk is IdentityRiskLevel.HIGH
    assert merge.after_hashes == split.before_hashes
    assert merge.rollback.restore_records == merge.before_records
    assert split.rollback.restore_records == split.before_records
