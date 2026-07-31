from __future__ import annotations

import argparse
import hashlib
import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml

from app.main import app

API_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = API_ROOT.parents[1]
OPENAPI_ROOT = API_ROOT / "openapi"
DEFAULT_MANIFEST = OPENAPI_ROOT / "panda-atlas-v1.manifest.json"
DEFAULT_OUTPUT = REPOSITORY_ROOT / ".release-gate" / "panda-atlas-v1-integrated.yaml"


class CanonicalOpenApiError(RuntimeError):
    pass


def _load_yaml(path: Path) -> dict[str, Any]:
    document = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise CanonicalOpenApiError(f"OpenAPI document must be an object: {path}")
    if not isinstance(document.get("paths"), dict):
        raise CanonicalOpenApiError(f"OpenAPI document must contain paths: {path}")
    return document


def _load_manifest(path: Path) -> dict[str, Any]:
    document = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(document, dict) or document.get("schema_version") != 1:
        raise CanonicalOpenApiError("Canonical OpenAPI manifest must use schema_version 1")
    if not isinstance(document.get("base"), str):
        raise CanonicalOpenApiError("Canonical OpenAPI manifest requires base")
    if not isinstance(document.get("overlays"), list) or not document["overlays"]:
        raise CanonicalOpenApiError("Canonical OpenAPI manifest requires overlays")
    return document


def _merge_named_section(
    target: dict[str, Any],
    overlay: dict[str, Any],
    *,
    section_name: str,
    source: Path,
) -> None:
    for name, value in overlay.items():
        if name in target and target[name] != value:
            raise CanonicalOpenApiError(
                f"Canonical OpenAPI {section_name} conflict for {name} from {source.name}"
            )
        target.setdefault(name, deepcopy(value))


def _merge_overlay(base: dict[str, Any], overlay: dict[str, Any], source: Path) -> None:
    paths = base.setdefault("paths", {})
    for route, path_item in overlay["paths"].items():
        if route in paths and paths[route] != path_item:
            raise CanonicalOpenApiError(
                f"Canonical OpenAPI path conflict for {route} from {source.name}"
            )
        paths.setdefault(route, deepcopy(path_item))

    base_components = base.setdefault("components", {})
    for section_name, section in overlay.get("components", {}).items():
        if not isinstance(section, dict):
            continue
        target_section = base_components.setdefault(section_name, {})
        if not isinstance(target_section, dict):
            raise CanonicalOpenApiError(
                f"Canonical OpenAPI components.{section_name} is not an object"
            )
        _merge_named_section(
            target_section,
            section,
            section_name=f"components.{section_name}",
            source=source,
        )

    tags = base.setdefault("tags", [])
    known_tags = {
        item.get("name")
        for item in tags
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    }
    for item in overlay.get("tags", []):
        if isinstance(item, dict) and item.get("name") not in known_tags:
            tags.append(deepcopy(item))
            known_tags.add(item.get("name"))


def _required_operations(
    manifest: dict[str, Any],
) -> tuple[tuple[str, str], ...]:
    raw = [
        *manifest.get("required_base_operations", []),
        *manifest.get("required_overlay_operations", []),
    ]
    operations: list[tuple[str, str]] = []
    for item in raw:
        if (
            not isinstance(item, list)
            or len(item) != 2
            or not all(isinstance(value, str) for value in item)
        ):
            raise CanonicalOpenApiError("Canonical manifest operations must be [path, method]")
        operations.append((item[0], item[1].lower()))
    return tuple(operations)


def _assert_operations(
    document: dict[str, Any],
    operations: tuple[tuple[str, str], ...],
    *,
    label: str,
) -> None:
    missing = []
    for route, method in operations:
        path_item = document.get("paths", {}).get(route)
        if not isinstance(path_item, dict) or method not in path_item:
            missing.append(f"{method.upper()} {route}")
    if missing:
        raise CanonicalOpenApiError(
            f"{label} is missing Archive governance operations: {', '.join(missing)}"
        )


def build_archive_governance_openapi(
    manifest_path: Path = DEFAULT_MANIFEST,
) -> dict[str, Any]:
    manifest = _load_manifest(manifest_path)
    root = manifest_path.parent
    base_path = root / manifest["base"]
    base = deepcopy(_load_yaml(base_path))

    base_operations = tuple(
        (item[0], item[1].lower())
        for item in manifest.get("required_base_operations", [])
    )
    _assert_operations(base, base_operations, label=base_path.name)

    for overlay_name in manifest["overlays"]:
        if not isinstance(overlay_name, str):
            raise CanonicalOpenApiError("Canonical OpenAPI overlay names must be strings")
        overlay_path = root / overlay_name
        _merge_overlay(base, _load_yaml(overlay_path), overlay_path)

    operations = _required_operations(manifest)
    _assert_operations(base, operations, label="Integrated canonical OpenAPI")
    _assert_operations(app.openapi(), operations, label="Generated FastAPI OpenAPI")
    return base


def write_archive_governance_openapi(
    output: Path = DEFAULT_OUTPUT,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> dict[str, object]:
    document = build_archive_governance_openapi(manifest_path)
    encoded = yaml.safe_dump(document, sort_keys=False, allow_unicode=True).encode("utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    checksum_path = output.with_suffix(f"{output.suffix}.sha256")
    checksum_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    return {
        "status": "PASS",
        "manifest": str(manifest_path),
        "output": str(output),
        "sha256": digest,
        "path_count": len(document["paths"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the canonical Archive governance OpenAPI contract"
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(json.dumps(write_archive_governance_openapi(args.output, args.manifest), indent=2))


if __name__ == "__main__":
    main()
