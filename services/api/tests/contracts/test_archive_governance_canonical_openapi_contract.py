from pathlib import Path

import yaml

CANONICAL_CONTRACT = (
    Path(__file__).resolve().parents[2] / "openapi" / "panda-atlas-v1.yaml"
)

ACCOUNTABLE_OPERATION_PATHS = (
    "/api/v1/admin/archive/operations/rollback",
    "/api/v1/admin/archive/operations/corrections",
    "/api/v1/admin/archive/operations/merge-split",
    "/api/v1/admin/archive/operations/emergency-takedowns",
    (
        "/api/v1/admin/archive/operations/emergency-takedowns/"
        "{operation_id}/followup"
    ),
    "/api/v1/admin/archive/operations/metrics",
)

ARCHIVE_WORKBENCH_PATHS = (
    "/api/v1/admin/archive/workbench",
    "/api/v1/admin/archive/workbench/metrics",
    "/api/v1/admin/archive/workbench/items/{item_id}",
    "/api/v1/admin/archive/workbench/cutover",
    "/api/v1/admin/archive/workbench/rehearsal-snapshot",
)


def _external_path_ref(filename: str, path: str) -> str:
    pointer = path.replace("~", "~0").replace("/", "~1")
    return f"./{filename}#/paths/{pointer}"


def test_canonical_openapi_registers_archive_governance_path_items() -> None:
    canonical = yaml.safe_load(CANONICAL_CONTRACT.read_text(encoding="utf-8"))

    for path in ACCOUNTABLE_OPERATION_PATHS:
        assert canonical["paths"][path] == {
            "$ref": _external_path_ref("accountable-archive-operations-v1.yaml", path)
        }
    for path in ARCHIVE_WORKBENCH_PATHS:
        assert canonical["paths"][path] == {
            "$ref": _external_path_ref("archive-workbench-v1.yaml", path)
        }
