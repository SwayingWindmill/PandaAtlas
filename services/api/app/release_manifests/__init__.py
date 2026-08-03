from __future__ import annotations

import json
from importlib.resources import files
from typing import Any


def load_release_manifest(version: str) -> dict[str, Any] | None:
    path = files(__package__).joinpath(f"{version}.json")
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
