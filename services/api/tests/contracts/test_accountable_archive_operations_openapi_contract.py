from pathlib import Path

import yaml

from app.main import app

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2]
    / "openapi"
    / "accountable-archive-operations-v1.yaml"
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/archive/operations/rollback", "post"),
    ("/api/v1/admin/archive/operations/corrections", "post"),
    ("/api/v1/admin/archive/operations/merge-split", "post"),
    ("/api/v1/admin/archive/operations/emergency-takedowns", "post"),
    (
        "/api/v1/admin/archive/operations/emergency-takedowns/{operation_id}/followup",
        "post",
    ),
    ("/api/v1/admin/archive/operations/metrics", "get"),
}


def test_accountable_archive_operation_openapi_matches_fastapi_routes() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    assert contract["components"]["securitySchemes"]["BearerAuth"]["scheme"] == "bearer"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_archive_operation_contract_freezes_release_and_activity_boundaries() -> None:
    contract = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))
    schemas = contract["components"]["schemas"]

    base = schemas["ArchiveOperationCommandBase"]
    assert base["properties"]["database_migration_version"]["default"] == "0023"
    for field in (
        "expected_archive_release_id",
        "idempotency_key",
        "reason",
        "data_version",
        "risk_level",
        "correlation_id",
    ):
        assert field in base["required"]

    correction = schemas["ArchiveCorrectionCommand"]["allOf"][1]
    assert "activity_descriptor" in correction["required"]
    descriptor = schemas["ArchiveActivityDescriptor"]
    assert descriptor["properties"]["action"]["enum"] == ["correction", "retraction"]
    assert "notification_eligible" in descriptor["required"]

    operation = schemas["ArchiveOperationRead"]
    assert operation["properties"]["public_projection_status"]["enum"] == [
        "pending",
        "projected",
    ]
    assert "outbox_event_id" in operation["required"]


def test_router_registers_operation_capabilities_and_path_guard() -> None:
    endpoints = (
        Path(__file__).resolve().parents[2]
        / "app"
        / "api"
        / "v1"
        / "admin_archive_operations.py"
    ).read_text(encoding="utf-8")

    for capability in (
        "archive.accountable.rollback",
        "archive.accountable.correct",
        "archive.sensitive.merge_split",
        "archive.sensitive.takedown",
        "archive.accountable.operation_metrics",
    ):
        assert capability in endpoints
    assert "archive_operation_path_mismatch" in endpoints
