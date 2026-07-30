from __future__ import annotations

from pathlib import Path

import yaml

from app.main import app

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "openapi" / "community-curation-v1.yaml"

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/community-curation/review-cases/{review_case_id}/bridge", "post"),
    ("/api/v1/admin/community-curation/bridges/{bridge_id}", "get"),
    ("/api/v1/admin/community-curation/releases/{release_id}/observed", "post"),
    (
        "/api/v1/admin/community-curation/bridges/{bridge_id}/releases/{release_id}/projection-result",
        "post",
    ),
    ("/api/v1/admin/community-curation/bridge-metrics", "get"),
}


def test_community_curation_openapi_matches_generated_routes() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    assert contract["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_community_curation_contract_freezes_projection_boundary() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    command = contract["components"]["schemas"]["RecordProjectionCommand"]
    outcome = contract["components"]["schemas"]["ProjectionOutcome"]

    assert outcome["enum"] == ["projected", "failed"]
    assert "public_version" in command["properties"]
    assert "incorporated_assertion_keys" in command["properties"]
    assert "notification_intent_id" in contract["components"]["schemas"]["ProjectionResultRead"][
        "properties"
    ]
