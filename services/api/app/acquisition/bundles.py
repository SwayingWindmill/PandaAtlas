from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from .contracts import AcquisitionBundle

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
LOCAL_BUNDLE_ROOT = _REPOSITORY_ROOT / ".acquisition" / "bundles"


def resolve_local_bundle_path(
    bundle: AcquisitionBundle,
    output: str | Path | None = None,
) -> Path:
    root = LOCAL_BUNDLE_ROOT.resolve()
    if output is None:
        candidate = root / f"{bundle.run.run_id}.json"
    else:
        requested = Path(output)
        candidate = requested if requested.is_absolute() else root / requested
        candidate = candidate.resolve()

    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise ValueError(
            f"acquisition bundles must stay below the local output root {root}"
        ) from error
    if candidate.suffix != ".json":
        raise ValueError("acquisition bundle output must use the .json suffix")
    return candidate


def write_local_bundle(
    bundle: AcquisitionBundle,
    output: str | Path | None = None,
    *,
    overwrite: bool = False,
) -> Path:
    output_path = resolve_local_bundle_path(bundle, output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        raise FileExistsError(f"acquisition bundle already exists: {output_path}")

    payload = json.dumps(bundle.to_dict(), ensure_ascii=False, indent=2) + "\n"
    temporary_path = output_path.with_name(f".{output_path.name}.{uuid4().hex}.tmp")
    try:
        temporary_path.write_text(payload, encoding="utf-8")
        temporary_path.replace(output_path)
    finally:
        temporary_path.unlink(missing_ok=True)
    return output_path
