from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.enrichment import IdentityCandidateBatch
from app.identity_resolution import IdentityDecisionKind, resolve_identity_batch
from app.knowledge.contracts import PopulationContext

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-identity-extraction.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-identity-extraction-fixtures" / "v1"


def test_checked_in_identity_extraction_schema_matches_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    assert checked_in == IdentityCandidateBatch.model_json_schema()


def test_identity_extraction_fixtures_validate_and_feed_identity_resolution() -> None:
    expected_names = {
        "group-observation.valid.json",
        "multilingual.valid.json",
        "unresolved-name-only.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))
    assert {path.name for path in fixture_paths} == expected_names

    fixtures = {
        path.name: IdentityCandidateBatch.model_validate_json(path.read_text(encoding="utf-8"))
        for path in fixture_paths
    }
    multilingual = fixtures["multilingual.valid.json"]
    extraction = multilingual.extractions[0]
    assert {name.language for name in extraction.names} == {"en", "ja", "ko", "zh"}
    assert extraction.features.birth_year == 2020
    assert extraction.evidence[0].evidence_body_sha256 == "a" * 64

    group = fixtures["group-observation.valid.json"].extractions[0]
    assert group.population_context is PopulationContext.WILD
    assert group.features.is_group_observation

    candidates = tuple(
        candidate for fixture in fixtures.values() for candidate in fixture.candidates
    )
    resolution = resolve_identity_batch(
        batch_id="fixture-identity-resolution",
        created_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=candidates,
    )
    kinds = {decision.kind for decision in resolution.decisions}
    assert kinds == {
        IdentityDecisionKind.CREATE,
        IdentityDecisionKind.REJECT_GROUP,
        IdentityDecisionKind.UNRESOLVED,
    }
