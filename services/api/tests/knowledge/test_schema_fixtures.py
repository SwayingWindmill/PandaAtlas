from __future__ import annotations

import json
from pathlib import Path

from app.knowledge.contracts import (
    PandaKnowledgeBundle,
    PublicationState,
    evaluate_record_publication,
)

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-knowledge.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-knowledge-fixtures" / "v1"


def test_checked_in_json_schema_matches_the_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

    assert checked_in == PandaKnowledgeBundle.model_json_schema()


def test_required_contract_fixtures_validate_and_route_deterministically() -> None:
    expected_fixture_names = {
        "direct-evidence.valid.json",
        "inferred-value.valid.json",
        "conflict.valid.json",
        "correction.valid.json",
        "withdrawal.valid.json",
        "tentative-lineage.valid.json",
        "unresolved-identity.valid.json",
        "missing-media.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))

    assert {path.name for path in fixture_paths} == expected_fixture_names

    decisions = {}
    for path in fixture_paths:
        bundle = PandaKnowledgeBundle.model_validate_json(path.read_text(encoding="utf-8"))
        identity_key = bundle.records[0].identity.identity_key
        decisions[path.name] = evaluate_record_publication(bundle, identity_key)

    assert decisions["unresolved-identity.valid.json"].state is PublicationState.BLOCKED
    assert decisions["missing-media.valid.json"].warnings == ("missing-cleared-media",)
    assert decisions["correction.valid.json"].public_assertion_ids == (
        "assertion-corrected-status",
    )
    assert decisions["withdrawal.valid.json"].public_assertion_ids == ()
    assert decisions["tentative-lineage.valid.json"].public_relationship_ids == (
        "relationship-tentative-mother",
    )
