from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.acquisition.contracts import canonical_json_bytes

from .contracts import DiscoveryRunResult

MANIFEST_FILENAME = "panda-discovery-manifest.v1.json"
INVENTORY_FILENAME = "panda-discovery-inventory.v1.json"


@dataclass(frozen=True, slots=True)
class DiscoveryArtifactPaths:
    manifest_path: Path
    inventory_path: Path


def write_discovery_artifacts(
    result: DiscoveryRunResult,
    output_dir: str | Path,
    *,
    overwrite: bool = False,
) -> DiscoveryArtifactPaths:
    """Write deterministic discovery manifest and inventory artifacts."""

    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    manifest_path = directory / MANIFEST_FILENAME
    inventory_path = directory / INVENTORY_FILENAME

    manifest_bytes = canonical_json_bytes(result.manifest.model_dump(mode="json")) + b"\n"
    inventory_bytes = canonical_json_bytes(result.inventory.model_dump(mode="json")) + b"\n"
    manifest_needs_write = _preflight_write(
        manifest_path,
        manifest_bytes,
        overwrite=overwrite,
    )
    inventory_needs_write = _preflight_write(
        inventory_path,
        inventory_bytes,
        overwrite=overwrite,
    )
    if manifest_needs_write:
        _atomic_write(manifest_path, manifest_bytes)
    if inventory_needs_write:
        _atomic_write(inventory_path, inventory_bytes)
    return DiscoveryArtifactPaths(
        manifest_path=manifest_path,
        inventory_path=inventory_path,
    )


def _preflight_write(path: Path, payload: bytes, *, overwrite: bool) -> bool:
    if not path.exists():
        return True
    if path.read_bytes() == payload:
        return False
    if not overwrite:
        raise FileExistsError(f"discovery artifact already exists with different content: {path}")
    return True


def _atomic_write(path: Path, payload: bytes) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_bytes(payload)
    temporary_path.replace(path)
