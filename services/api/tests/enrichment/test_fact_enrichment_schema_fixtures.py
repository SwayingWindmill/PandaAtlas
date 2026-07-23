from __future__ import annotations

import json
from pathlib import Path

from app.enrichment import FactEnrichmentBatch
from app.knowledge.contracts import (
    AssertionLifecycle,
    ConclusionStatus,
    EvidenceMode,
    RelationshipStatus,
    evaluate_record_publication,
)

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-fact-enrichment.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-fact-enrichment-fixtures" / "v1"


def test_checked_in_fact_enrichment_schema_matches_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    assert checked_in == FactEnrichmentBatch.model_json_schema()


def test_fact_enrichment_acceptance_fixtures_cover_core_routes() -> None:
    expected_names = {
        "conflict.valid.json",
        "correction.valid.json",
        "direct-and-review.valid.json",
        "inferred.valid.json",
        "tentative-relationship.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))
    assert {path.name for path in fixture_paths} == expected_names
    fixtures = {
        path.name: FactEnrichmentBatch.model_validate_json(path.read_text(encoding="utf-8"))
        for path in fixture_paths
    }

    direct = fixtures["direct-and-review.valid.json"]
    record = direct.knowledge_bundle.records[0]
    decision = evaluate_record_publication(direct.knowledge_bundle, record.identity.identity_key)
    assert len(decision.public_assertion_ids) == 1
    assert len(decision.review_assertion_ids) == 1

    conflict = fixtures["conflict.valid.json"].knowledge_bundle.records[0]
    assert conflict.conclusions[0].status is ConclusionStatus.DISPUTED
    assert conflict.conclusions[0].alternative_assertion_ids

    inferred = fixtures["inferred.valid.json"].knowledge_bundle.records[0]
    inferred_assertions = [
        assertion
        for assertion in inferred.assertions
        if assertion.evidence_mode is EvidenceMode.INFERRED
    ]
    assert len(inferred_assertions) == 1
    assert inferred_assertions[0].derivation is not None

    correction = fixtures["correction.valid.json"].knowledge_bundle.records[0]
    superseded = [
        assertion
        for assertion in correction.assertions
        if assertion.lifecycle is AssertionLifecycle.SUPERSEDED
    ]
    assert len(superseded) == 1
    assert superseded[0].superseded_by is not None

    relationship = fixtures["tentative-relationship.valid.json"].knowledge_bundle.records[0]
    assert relationship.relationships[0].status is RelationshipStatus.TENTATIVE
