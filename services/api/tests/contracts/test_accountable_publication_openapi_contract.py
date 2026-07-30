from __future__ import annotations

from pathlib import Path

import yaml

from app.main import app

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2]
    / "openapi"
    / "accountable-publication-v1.yaml"
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/archive/change-sets/{change_set_id}/validate", "post"),
    ("/api/v1/admin/archive/change-sets/{change_set_id}/publish", "post"),
    ("/api/v1/admin/archive/publication-metrics", "get"),
}


def test_accountable_publication_openapi_matches_fastapi_routes() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    assert contract["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_accountable_publication_contract_freezes_release_boundaries() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    release = contract["components"]["schemas"]["AccountableRelease"]
    projection = release["properties"]["public_projection_status"]
    assert projection["enum"] == ["pending", "projected"]
    assert "outbox_event_id" in release["required"]
    assert "base_archive_version" in release["required"]

    publish = contract["paths"][
        "/api/v1/admin/archive/change-sets/{change_set_id}/publish"
    ]["post"]
    assert "403" in publish["responses"]
    assert "409" in publish["responses"]
    assert "public Release pointer" in publish["description"]


def test_accountable_commands_require_versions_and_idempotency() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    for schema_name in ("AccountableValidationCommand", "AccountablePublishCommand"):
        required = contract["components"]["schemas"][schema_name]["required"]
        assert "expected_version" in required
        assert "idempotency_key" in required
        assert "correlation_id" in required
