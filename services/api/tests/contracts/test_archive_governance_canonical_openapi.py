import hashlib
import json
from pathlib import Path

import pytest
import yaml

from scripts.build_archive_governance_openapi import (
    CanonicalOpenApiError,
    build_archive_governance_openapi,
    write_archive_governance_openapi,
)

REQUIRED_OPERATIONS = {
    ("/api/v1/admin/archive/change-sets/{change_set_id}/validate", "post"),
    ("/api/v1/admin/archive/change-sets/{change_set_id}/publish", "post"),
    ("/api/v1/admin/archive/publication-metrics", "get"),
    ("/api/v1/admin/archive/operations/rollback", "post"),
    ("/api/v1/admin/archive/operations/corrections", "post"),
    ("/api/v1/admin/archive/operations/merge-split", "post"),
    ("/api/v1/admin/archive/operations/emergency-takedowns", "post"),
    (
        "/api/v1/admin/archive/operations/emergency-takedowns/"
        "{operation_id}/followup",
        "post",
    ),
    ("/api/v1/admin/archive/operations/metrics", "get"),
    ("/api/v1/admin/archive/workbench", "get"),
    ("/api/v1/admin/archive/workbench/metrics", "get"),
    ("/api/v1/admin/archive/workbench/items/{item_id}", "get"),
    ("/api/v1/admin/archive/workbench/cutover", "get"),
    ("/api/v1/admin/archive/workbench/cutover", "post"),
    ("/api/v1/admin/archive/workbench/rehearsal-snapshot", "get"),
}


def test_archive_governance_canonical_contract_merges_all_bounded_routes() -> None:
    document = build_archive_governance_openapi()

    assert document["openapi"] == "3.1.0"
    for route, method in REQUIRED_OPERATIONS:
        assert method in document["paths"][route]
    assert "ArchiveWorkbenchDetailRead" in document["components"]["schemas"]
    assert document["components"]["securitySchemes"]["BearerAuth"] == {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }


def test_archive_governance_canonical_contract_writes_tamper_evident_artifact(
    tmp_path: Path,
) -> None:
    output = tmp_path / "panda-atlas-v1-integrated.yaml"
    result = write_archive_governance_openapi(output=output)

    encoded = output.read_bytes()
    assert result["status"] == "PASS"
    assert result["sha256"] == hashlib.sha256(encoded).hexdigest()
    assert result["path_count"] > 0
    assert yaml.safe_load(encoded)["paths"]["/api/v1/admin/archive/workbench"]
    assert output.with_suffix(".yaml.sha256").read_text(encoding="utf-8") == (
        f"{result['sha256']}  {output.name}\n"
    )


def test_archive_governance_canonical_contract_fails_on_overlay_conflict(
    tmp_path: Path,
) -> None:
    base = {
        "openapi": "3.1.0",
        "info": {"title": "base", "version": "1"},
        "paths": {"/conflict": {"get": {"operationId": "base"}}},
    }
    overlay = {
        "openapi": "3.1.0",
        "info": {"title": "overlay", "version": "1"},
        "paths": {"/conflict": {"get": {"operationId": "overlay"}}},
    }
    (tmp_path / "base.yaml").write_text(
        yaml.safe_dump(base, sort_keys=False), encoding="utf-8"
    )
    (tmp_path / "overlay.yaml").write_text(
        yaml.safe_dump(overlay, sort_keys=False), encoding="utf-8"
    )
    manifest = {
        "schema_version": 1,
        "base": "base.yaml",
        "overlays": ["overlay.yaml"],
        "required_base_operations": [],
        "required_overlay_operations": [],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(CanonicalOpenApiError, match="path conflict"):
        build_archive_governance_openapi(manifest_path)
