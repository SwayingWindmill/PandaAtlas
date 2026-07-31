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

REQUIRED_ROUTES = {
    "/api/v1/admin/archive/change-sets/{change_set_id}/validate",
    "/api/v1/admin/archive/change-sets/{change_set_id}/publish",
    "/api/v1/admin/archive/publication-metrics",
    "/api/v1/admin/archive/operations/rollback",
    "/api/v1/admin/archive/operations/corrections",
    "/api/v1/admin/archive/operations/merge-split",
    "/api/v1/admin/archive/operations/emergency-takedowns",
    (
        "/api/v1/admin/archive/operations/emergency-takedowns/"
        "{operation_id}/followup"
    ),
    "/api/v1/admin/archive/operations/metrics",
    "/api/v1/admin/archive/workbench",
    "/api/v1/admin/archive/workbench/metrics",
    "/api/v1/admin/archive/workbench/items/{item_id}",
    "/api/v1/admin/archive/workbench/cutover",
    "/api/v1/admin/archive/workbench/rehearsal-snapshot",
}


def test_archive_governance_canonical_contract_registers_all_bounded_routes() -> None:
    document = build_archive_governance_openapi()

    assert document["openapi"] == "3.1.0"
    assert REQUIRED_ROUTES.issubset(document["paths"])
    assert document["paths"]["/api/v1/admin/archive/change-sets/{change_set_id}/publish"] == {
        "$ref": (
            "./accountable-publication-v1.yaml#/paths/"
            "~1api~1v1~1admin~1archive~1change-sets~1{change_set_id}~1publish"
        )
    }
    assert document["paths"]["/api/v1/admin/archive/operations/rollback"] == {
        "$ref": (
            "./accountable-archive-operations-v1.yaml#/paths/"
            "~1api~1v1~1admin~1archive~1operations~1rollback"
        )
    }
    assert document["paths"]["/api/v1/admin/archive/workbench"] == {
        "$ref": "./archive-workbench-v1.yaml#/paths/~1api~1v1~1admin~1archive~1workbench"
    }


def test_archive_governance_canonical_contract_writes_portable_hashed_bundle(
    tmp_path: Path,
) -> None:
    output = tmp_path / "panda-atlas-v1-integrated.yaml"
    result = write_archive_governance_openapi(output=output)

    encoded = output.read_bytes()
    assert result["status"] == "PASS"
    assert result["sha256"] == hashlib.sha256(encoded).hexdigest()
    assert result["path_count"] > 0
    assert {
        "accountable-publication-v1.yaml",
        "accountable-archive-operations-v1.yaml",
        "archive-workbench-v1.yaml",
    }.issubset(set(result["bundled_sources"]))
    for source in result["bundled_sources"]:
        assert (tmp_path / source).is_file()
    assert (tmp_path / "panda-atlas-v1.manifest.json").is_file()
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
