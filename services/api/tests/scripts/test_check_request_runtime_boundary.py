from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_CHECKER_PATH = _SERVICE_ROOT / "scripts" / "check_request_runtime_boundary.py"
_SPEC = importlib.util.spec_from_file_location("check_request_runtime_boundary", _CHECKER_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_CHECKER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _CHECKER
_SPEC.loader.exec_module(_CHECKER)

RuntimeBoundaryError = _CHECKER.RuntimeBoundaryError
analyze_request_runtime_boundary = _CHECKER.analyze_request_runtime_boundary


def _write_file(root: Path, relative_path: str, content: str) -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _contract() -> dict[str, object]:
    return {
        "schema_version": 1,
        "entrypoints": ["app.main"],
        "service_root": "services/api",
        "application_package": "app",
        "batch_only_prefixes": [
            "app.acquisition",
            "app.enrichment",
            "app.identity_resolution",
        ],
        "forbidden_local_roots": ["scripts"],
        "forbidden_request_import_roots": ["PIL", "scrapling", "scrapy"],
        "separated_dependencies": [
            {
                "distribution": "pillow",
                "import_root": "PIL",
                "required_optional_group": "dev",
            },
            {
                "distribution": "scrapy",
                "import_root": "scrapy",
                "required_optional_group": "crawler-poc",
            },
        ],
    }


def _write_fixture_repository(
    root: Path,
    *,
    service_source: str = "def read_value() -> str:\n    return 'ok'\n",
    base_dependencies: tuple[str, ...] = ("fastapi>=0.115.0",),
) -> Path:
    contract_path = root / "contracts" / "api-request-runtime-boundary.v1.json"
    _write_file(root, "contracts/api-request-runtime-boundary.v1.json", "")
    contract_path.write_text(json.dumps(_contract()), encoding="utf-8")

    dependencies = ",\n  ".join(f'"{item}"' for item in base_dependencies)
    _write_file(
        root,
        "services/api/pyproject.toml",
        f"""[project]
name = "fixture-api"
version = "0.0.0"
dependencies = [
  {dependencies}
]

[project.optional-dependencies]
dev = ["pillow==12.3.0"]
crawler-poc = ["scrapy==2.17.0"]
""",
    )
    _write_file(root, "services/api/app/__init__.py", "")
    _write_file(root, "services/api/app/api/__init__.py", "")
    _write_file(root, "services/api/app/services/__init__.py", "")
    _write_file(
        root,
        "services/api/app/main.py",
        "from app.api import router\n\napplication = router.router\n",
    )
    _write_file(
        root,
        "services/api/app/api/router.py",
        "from app.services import public\n\nrouter = public.read_value\n",
    )
    _write_file(root, "services/api/app/services/public.py", service_source)
    return contract_path


def test_accepts_a_bounded_transitive_request_graph(tmp_path: Path) -> None:
    contract_path = _write_fixture_repository(tmp_path)

    report = analyze_request_runtime_boundary(
        repository_root=tmp_path,
        contract_path=contract_path,
    )

    assert report.entrypoints == ("app.main",)
    assert report.modules == (
        "app.api",
        "app.api.router",
        "app.main",
        "app.services",
        "app.services.public",
    )


def test_rejects_a_transitive_batch_only_import_with_the_chain(tmp_path: Path) -> None:
    contract_path = _write_fixture_repository(
        tmp_path,
        service_source="from app.acquisition import runner\n",
    )
    _write_file(tmp_path, "services/api/app/acquisition/__init__.py", "")
    _write_file(tmp_path, "services/api/app/acquisition/runner.py", "")

    with pytest.raises(RuntimeBoundaryError) as captured:
        analyze_request_runtime_boundary(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "app.main -> app.api.router -> app.services.public -> app.acquisition" in violation
        for violation in captured.value.violations
    )


def test_rejects_heavy_optional_imports_from_request_modules(tmp_path: Path) -> None:
    contract_path = _write_fixture_repository(
        tmp_path,
        service_source="from PIL import Image\n",
    )

    with pytest.raises(RuntimeBoundaryError) as captured:
        analyze_request_runtime_boundary(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any("forbidden optional dependency PIL" in item for item in captured.value.violations)


def test_rejects_dynamic_imports_inside_the_request_closure(tmp_path: Path) -> None:
    contract_path = _write_fixture_repository(
        tmp_path,
        service_source=(
            "from importlib import import_module\n\n"
            "def read_value() -> object:\n"
            "    return import_module('app.acquisition.runner')\n"
        ),
    )

    with pytest.raises(RuntimeBoundaryError) as captured:
        analyze_request_runtime_boundary(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any("dynamic import through import_module" in item for item in captured.value.violations)


def test_rejects_batch_dependencies_in_base_runtime_dependencies(tmp_path: Path) -> None:
    contract_path = _write_fixture_repository(
        tmp_path,
        base_dependencies=("fastapi>=0.115.0", "scrapy==2.17.0"),
    )

    with pytest.raises(RuntimeBoundaryError) as captured:
        analyze_request_runtime_boundary(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "distribution scrapy must not be a base request dependency" in item
        for item in captured.value.violations
    )
