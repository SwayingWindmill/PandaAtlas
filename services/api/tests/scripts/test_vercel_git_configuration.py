from __future__ import annotations

import json
from pathlib import Path

_SERVICE_ROOT = Path(__file__).resolve().parents[2]


def test_vercel_configuration_uses_zero_config_nest_deployment() -> None:
    config = json.loads((_SERVICE_ROOT / "vercel.json").read_text(encoding="utf-8"))

    assert config == {"$schema": "https://openapi.vercel.sh/vercel.json"}
    assert "functions" not in config
    assert "git" not in config
