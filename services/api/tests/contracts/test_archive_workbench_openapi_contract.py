from pathlib import Path

import yaml

from app.main import app

CONTRACT = (
    Path(__file__).resolve().parents[2]
    / "openapi"
    / "archive-workbench-v1.yaml"
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/archive/workbench", "get"),
    ("/api/v1/admin/archive/workbench/metrics", "get"),
    ("/api/v1/admin/archive/workbench/items/{item_id}", "get"),
    ("/api/v1/admin/archive/workbench/cutover", "get"),
    ("/api/v1/admin/archive/workbench/cutover", "post"),
    ("/api/v1/admin/archive/workbench/rehearsal-snapshot", "get"),
}


def test_archive_workbench_contract_matches_fastapi_routes() -> None:
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    generated = app.openapi()

    assert contract["openapi"] == "3.1.0"
    for path, method in REQUIRED_OPERATIONS:
        assert method in contract["paths"][path]
        assert method in generated["paths"][path]


def test_archive_workbench_contract_has_no_generic_crud() -> None:
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    paths = contract["paths"]

    assert not any("delete" in item for item in paths.values())
    assert not any("put" in item or "patch" in item for item in paths.values())
    cutover = paths["/api/v1/admin/archive/workbench/cutover"]["post"]
    assert cutover["operationId"] == "setArchiveCutoverControl"
    assert "recent authentication" in cutover["responses"]["403"]["description"].lower()


def test_rehearsal_contract_freezes_go_no_go_hash() -> None:
    contract = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    rehearsal = contract["components"]["schemas"]["ArchiveRehearsalSnapshotRead"]

    for field in (
        "old_state_counts",
        "accountable_state_counts",
        "release_counts",
        "orphan_counts",
        "historical_audit_count",
        "canonical_sha256",
        "go",
        "blockers",
    ):
        assert field in rehearsal["required"]
    assert rehearsal["properties"]["canonical_sha256"]["pattern"] == "^[a-f0-9]{64}$"
