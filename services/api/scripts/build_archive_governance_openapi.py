from __future__ import annotations

import argparse
import hashlib
import json
import shutil
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


def _path_pointer(route: str) -> str:
    return route.replace("~", "~0").replace("/", "~1")


def _overlay_reference(source_name: str, route: str) -> str:
    return f"./{source_name}#/paths/{_path_pointer(route)}"


def _register_overlay(
    base: dict[str, Any],
    overlay: dict[str, Any],
    source: Path,
) -> None:
    paths = base.setdefault("paths", {})
    for route, path_item in overlay["paths"].items():
        expected = {"$ref": _overlay_reference(source.name, route)}
        existing = paths.get(route)
        if existing is None:
            paths[route] = expected
        elif existing not in (expected, path_item):
            raise CanonicalOpenApiError(
                f"Canonical OpenAPI path conflict for {route} from {source.name}"
            )


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


def _resolve_pointer(document: dict[str, Any], fragment: str) -> object:
    if not fragment.startswith("/"):
        raise CanonicalOpenApiError(f"Unsupported OpenAPI reference fragment: {fragment}")
    value: object = document
    for raw_part in fragment.removeprefix("/").split("/"):
        part = raw_part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or part not in value:
            raise CanonicalOpenApiError(f"OpenAPI reference fragment is missing: {fragment}")
        value = value[part]
    return value


def _resolve_path_item(
    document: dict[str, Any],
    route: str,
    *,
    source_root: Path | None,
) -> dict[str, Any] | None:
    path_item = document.get("paths", {}).get(route)
    visited: set[str] = set()
    while isinstance(path_item, dict) and isinstance(path_item.get("$ref"), str):
        reference = path_item["$ref"]
        if reference in visited:
            raise CanonicalOpenApiError(f"OpenAPI path reference cycle: {reference}")
        visited.add(reference)
        if source_root is None or not reference.startswith("./"):
            raise CanonicalOpenApiError(f"Unsupported OpenAPI path reference: {reference}")
        file_name, separator, fragment = reference.removeprefix("./").partition("#")
        if not separator:
            raise CanonicalOpenApiError(f"OpenAPI path reference lacks fragment: {reference}")
        referenced = _load_yaml(source_root / file_name)
        resolved = _resolve_pointer(referenced, fragment)
        if not isinstance(resolved, dict):
            raise CanonicalOpenApiError(f"OpenAPI path reference is not an object: {reference}")
        path_item = resolved
    return path_item if isinstance(path_item, dict) else None


def _assert_operations(
    document: dict[str, Any],
    operations: tuple[tuple[str, str], ...],
    *,
    label: str,
    source_root: Path | None = None,
) -> None:
    missing = []
    for route, method in operations:
        path_item = _resolve_path_item(document, route, source_root=source_root)
        if path_item is None or method not in path_item:
            missing.append(f"{method.upper()} {route}")
    if missing:
        raise CanonicalOpenApiError(
            f"{label} is missing Archive governance operations: {', '.join(missing)}"
        )


def _local_references(value: object) -> set[str]:
    references: set[str] = set()
    if isinstance(value, dict):
        reference = value.get("$ref")
        if isinstance(reference, str) and reference.startswith("./"):
            references.add(reference)
        for item in value.values():
            references.update(_local_references(item))
    elif isinstance(value, list):
        for item in value:
            references.update(_local_references(item))
    return references


def _copy_reference_bundle(
    document: dict[str, Any],
    *,
    source_root: Path,
    output_root: Path,
) -> list[str]:
    source_root = source_root.resolve()
    queue: list[tuple[Path, str]] = [(source_root, ref) for ref in _local_references(document)]
    copied: set[Path] = set()

    while queue:
        reference_base, reference = queue.pop()
        file_part = reference.removeprefix("./").split("#", maxsplit=1)[0]
        source = (reference_base / file_part).resolve()
        try:
            relative = source.relative_to(source_root)
        except ValueError as error:
            raise CanonicalOpenApiError(
                f"OpenAPI reference escapes the canonical root: {reference}"
            ) from error
        if relative in copied:
            continue
        if not source.is_file():
            raise CanonicalOpenApiError(f"OpenAPI reference file is missing: {source}")
        destination = output_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        copied.add(relative)
        referenced_document = _load_yaml(source)
        queue.extend(
            (source.parent, nested_reference)
            for nested_reference in _local_references(referenced_document)
        )

    return sorted(path.as_posix() for path in copied)


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
    _assert_operations(
        base,
        base_operations,
        label=base_path.name,
        source_root=root,
    )

    for overlay_name in manifest["overlays"]:
        if not isinstance(overlay_name, str):
            raise CanonicalOpenApiError("Canonical OpenAPI overlay names must be strings")
        overlay_path = root / overlay_name
        _register_overlay(base, _load_yaml(overlay_path), overlay_path)

    operations = _required_operations(manifest)
    _assert_operations(
        base,
        operations,
        label="Integrated canonical OpenAPI",
        source_root=root,
    )
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
    bundled_sources = _copy_reference_bundle(
        document,
        source_root=manifest_path.parent,
        output_root=output.parent,
    )
    shutil.copyfile(manifest_path, output.parent / manifest_path.name)
    digest = hashlib.sha256(encoded).hexdigest()
    checksum_path = output.with_suffix(f"{output.suffix}.sha256")
    checksum_path.write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    return {
        "status": "PASS",
        "manifest": str(manifest_path),
        "output": str(output),
        "sha256": digest,
        "path_count": len(document["paths"]),
        "bundled_sources": bundled_sources,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the canonical Archive governance OpenAPI contract bundle"
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    print(json.dumps(write_archive_governance_openapi(args.output, args.manifest), indent=2))


if __name__ == "__main__":
    main()
