from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from app.acquisition.contracts import canonical_json_bytes

from .contracts import (
    SCHEMA_VERSION,
    IdentityChangeSet,
    IdentityResolutionBatch,
    IdentityResolutionPackage,
)

IDENTITY_PACKAGE_FILENAME = "panda-identity-resolution.v1.json"


@dataclass(frozen=True, slots=True)
class IdentityArtifactPath:
    package_path: Path


def build_identity_resolution_package(
    batch: IdentityResolutionBatch,
    *,
    changesets: tuple[IdentityChangeSet, ...] = (),
) -> IdentityResolutionPackage:
    ordered_changesets = tuple(sorted(changesets, key=lambda item: item.operation_id))
    payload = {
        "schema_version": SCHEMA_VERSION,
        "batch": batch.model_dump(mode="json"),
        "changesets": [changeset.model_dump(mode="json") for changeset in ordered_changesets],
    }
    return IdentityResolutionPackage(
        package_id=f"identity-package-{sha256(canonical_json_bytes(payload)).hexdigest()}",
        batch=batch,
        changesets=ordered_changesets,
    )


def write_identity_resolution_package(
    package: IdentityResolutionPackage,
    output_dir: str | Path,
    *,
    overwrite: bool = False,
) -> IdentityArtifactPath:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    package_path = directory / IDENTITY_PACKAGE_FILENAME
    payload = canonical_json_bytes(package.model_dump(mode="json")) + b"\n"
    if package_path.exists():
        current = package_path.read_bytes()
        if current == payload:
            return IdentityArtifactPath(package_path=package_path)
        if not overwrite:
            raise FileExistsError(
                f"identity resolution artifact exists with different content: {package_path}"
            )
    temporary_path = package_path.with_suffix(package_path.suffix + ".tmp")
    temporary_path.write_bytes(payload)
    temporary_path.replace(package_path)
    return IdentityArtifactPath(package_path=package_path)
