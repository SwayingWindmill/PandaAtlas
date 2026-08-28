from __future__ import annotations

import os
from pathlib import Path


class RepositoryPathError(RuntimeError):
    pass


def repository_root() -> Path:
    configured = os.getenv("PANDA_DATA_REPOSITORY_ROOT")
    if configured:
        path = Path(configured).expanduser().resolve()
        if not (path / "AGENTS.md").is_file():
            raise RepositoryPathError(
                f"PANDA_DATA_REPOSITORY_ROOT is not a PandaAtlas checkout: {path}"
            )
        return path

    for parent in Path(__file__).resolve().parents:
        if (parent / "AGENTS.md").is_file() and (parent / "data").is_dir():
            return parent
    raise RepositoryPathError(
        "Could not locate the PandaAtlas repository. Set PANDA_DATA_REPOSITORY_ROOT "
        "when running outside the checkout."
    )
