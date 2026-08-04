from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_BUILDER_PATH = _SERVICE_ROOT / "scripts" / "build_serverless_closure.py"
_SPEC = importlib.util.spec_from_file_location(
    "build_serverless_closure_for_git_config_test",
    _BUILDER_PATH,
)
assert _SPEC is not None and _SPEC.loader is not None
_BUILDER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _BUILDER
_SPEC.loader.exec_module(_BUILDER)


def _validate(tmp_path: Path, deployment_enabled: bool) -> list[str]:
    config_path = tmp_path / "vercel.json"
    config_path.write_text(
        json.dumps(
            {
                "$schema": "https://openapi.vercel.sh/vercel.json",
                "git": {"deploymentEnabled": deployment_enabled},
                "functions": {
                    "index.py": {"excludeFiles": "{tests/**,scripts/**}"}
                },
            }
        ),
        encoding="utf-8",
    )
    return _BUILDER._validate_vercel_configuration(
        config_path=config_path,
        function_name="index.py",
        exclude_files=["tests/**", "scripts/**"],
    )


def test_vercel_configuration_accepts_disabled_git_deployments(tmp_path: Path) -> None:
    assert _validate(tmp_path, deployment_enabled=False) == []


def test_vercel_configuration_rejects_enabled_git_deployments(tmp_path: Path) -> None:
    violations = _validate(tmp_path, deployment_enabled=True)
    assert "Vercel automatic Git deployments must be disabled" in violations
