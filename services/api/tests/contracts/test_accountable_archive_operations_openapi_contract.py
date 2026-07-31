from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
BOUNDED_OPENAPI = (
    REPO_ROOT
    / "services"
    / "api"
    / "openapi"
    / "accountable-archive-operations-v1.yaml"
)
ROUTER = REPO_ROOT / "services" / "api" / "app" / "api" / "router.py"
ENDPOINTS = (
    REPO_ROOT
    / "services"
    / "api"
    / "app"
    / "api"
    / "v1"
    / "admin_archive_operations.py"
)


def test_accountable_archive_operation_paths_are_explicit() -> None:
    contract = BOUNDED_OPENAPI.read_text(encoding="utf-8")

    for path in (
        "/admin/archive/operations/rollback:",
        "/admin/archive/operations/corrections:",
        "/admin/archive/operations/merge-split:",
        "/admin/archive/operations/emergency-takedowns:",
        "/admin/archive/operations/emergency-takedowns/{operation_id}/followup:",
        "/admin/archive/operations/metrics:",
    ):
        assert path in contract
    assert "bearerAuth" in contract
    assert "database_migration_version: {type: string, default: '0022'}" in contract
    assert "public_projection_status" in contract
    assert "pending, projected" in contract


def test_router_registers_bounded_operation_endpoints() -> None:
    router = ROUTER.read_text(encoding="utf-8")
    endpoints = ENDPOINTS.read_text(encoding="utf-8")

    assert "admin_archive_operations" in router
    assert "admin_archive_operations.router" in router
    for capability in (
        "archive.accountable.rollback",
        "archive.accountable.correct",
        "archive.sensitive.merge_split",
        "archive.sensitive.takedown",
        "archive.accountable.operation_metrics",
    ):
        assert capability in endpoints
    assert "archive_operation_path_mismatch" in endpoints
