from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
from pathlib import Path

import httpx
import pytest

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_REPOSITORY_ROOT = _SERVICE_ROOT.parents[1]
_BUILDER_PATH = _SERVICE_ROOT / "scripts" / "build_serverless_closure.py"
_SPEC = importlib.util.spec_from_file_location("build_serverless_closure", _BUILDER_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_BUILDER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _BUILDER
_SPEC.loader.exec_module(_BUILDER)

ServerlessClosureError = _BUILDER.ServerlessClosureError
build_serverless_closure = _BUILDER.build_serverless_closure


def test_real_serverless_closure_is_deterministic_and_bounded() -> None:
    first = build_serverless_closure(repository_root=_REPOSITORY_ROOT)
    second = build_serverless_closure(repository_root=_REPOSITORY_ROOT)

    assert first.to_json() == second.to_json()
    payload = first.payload
    assert payload["platform"] == "vercel"
    assert payload["python_version"] == "3.12"
    assert payload["entrypoint"] == {
        "file": "services/api/index.py",
        "module": "index",
        "symbol": "app",
        "target": "app.main:app",
    }
    assert payload["request_boundary"]["modules_checked"] == len(
        payload["request_boundary"]["modules"]
    )
    assert payload["vercel_configuration"]["function"] == "**/*.py"
    assert "tests/**" in payload["vercel_configuration"]["exclude_files"]
    assert "services/api/app/acquisition/adapters.py" in payload[
        "excluded_tracked_files"
    ]
    assert payload["summary"]["excluded_tracked_file_count"] > 0
    assert "app.main" in payload["request_boundary"]["modules"]
    assert payload["summary"]["module_count"] == 105

    runtime_distributions = {
        item["distribution"] for item in payload["runtime_dependencies"]
    }
    assert runtime_distributions == {
        "cryptography",
        "fastapi",
        "httpx",
        "psycopg",
        "pydantic-settings",
        "pyjwt",
        "python-multipart",
        "sqlalchemy",
    }
    assert "uvicorn" not in runtime_distributions

    optional_groups = {
        item["group"]: set(item["distributions"])
        for item in payload["optional_dependencies_excluded"]
    }
    assert "uvicorn" in optional_groups["local-server"]
    assert {"pillow", "pytest", "ruff"}.issubset(optional_groups["dev"])
    assert {"scrapling", "scrapy"}.issubset(optional_groups["crawler-poc"])

    file_paths = [item["path"] for item in payload["files"]]
    assert file_paths == sorted(file_paths)
    assert "services/api/index.py" in file_paths
    assert "services/api/.python-version" in file_paths
    assert "services/api/app/__init__.py" in file_paths
    assert "services/api/app/main.py" in file_paths
    assert "services/api/pyproject.toml" in file_paths
    assert "services/api/uv.lock" in file_paths
    assert any("app/notification/templates/" in item for item in file_paths)
    assert not any("/tests/" in item or "/scripts/" in item for item in file_paths)
    assert not any("/app/acquisition/" in item for item in file_paths)
    assert not any("/app/enrichment/" in item for item in file_paths)
    assert not any("/app/identity_resolution/" in item for item in file_paths)

    for record in [*payload["contracts"], *payload["files"]]:
        assert len(record["sha256"]) == 64
        int(record["sha256"], 16)
        assert record["bytes"] >= 0


def test_vercel_entrypoint_reexports_the_authoritative_app() -> None:
    import index
    from app.main import app as authoritative_app

    assert index.app is authoritative_app
    assert index.__all__ == ["app"]


def test_vercel_entrypoint_serves_asgi_requests() -> None:
    import index

    async def request_openapi() -> httpx.Response:
        transport = httpx.ASGITransport(app=index.app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="https://api.example.test",
        ) as client:
            return await client.get("/openapi.json")

    response = asyncio.run(request_openapi())
    assert response.status_code == 200
    assert response.json()["info"]["title"] == index.app.title


def test_vercel_configuration_validator_rejects_exclusion_drift(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "vercel.json"
    config_path.write_text(
        json.dumps(
            {
                "$schema": "https://openapi.vercel.sh/vercel.json",
                "functions": {"index.py": {"excludeFiles": "{tests/**}"}},
            }
        ),
        encoding="utf-8",
    )

    violations = _BUILDER._validate_vercel_configuration(
        config_path=config_path,
        function_name="index.py",
        exclude_files=["tests/**", "scripts/**"],
    )

    assert any("must equal the serverless contract" in item for item in violations)


def test_entrypoint_validator_rejects_runtime_logic(tmp_path: Path) -> None:
    entrypoint = tmp_path / "index.py"
    entrypoint.write_text(
        "from app.main import app\nprint('unexpected build-time behavior')\n",
        encoding="utf-8",
    )

    violations = _BUILDER._validate_entrypoint(
        entrypoint_path=entrypoint,
        target="app.main:app",
        exported_symbol="app",
    )

    assert any("unsupported statement" in item for item in violations)


def test_dependency_validator_rejects_local_server_in_base_dependencies() -> None:
    contract = json.loads(
        (_REPOSITORY_ROOT / "contracts" / "api-serverless-runtime.v1.json").read_text(
            encoding="utf-8"
        )
    )
    requirements = {
        item["distribution"]: f"{item['distribution']}>=1"
        for item in contract["runtime_dependencies"]
    }
    requirements["uvicorn"] = "uvicorn[standard]>=0.30.0"
    optional_groups = {
        "local-server": {"uvicorn"},
        "dev": {"pillow"},
        "crawler-poc": {"scrapling", "scrapy"},
    }
    external_roots = (
        "fastapi",
        "httpx",
        "jwt",
        "psycopg",
        "pydantic",
        "pydantic_settings",
        "sqlalchemy",
    )

    violations = _BUILDER._validate_dependencies(
        contract=contract,
        requirements=requirements,
        optional_groups=optional_groups,
        external_import_roots=external_roots,
    )

    assert "forbidden base serverless dependency: uvicorn" in violations
    assert any("undeclared items: uvicorn" in item for item in violations)


def test_dependency_validator_rejects_unclassified_import_roots() -> None:
    contract = json.loads(
        (_REPOSITORY_ROOT / "contracts" / "api-serverless-runtime.v1.json").read_text(
            encoding="utf-8"
        )
    )
    requirements = {
        item["distribution"]: f"{item['distribution']}>=1"
        for item in contract["runtime_dependencies"]
    }
    optional_groups = {
        "local-server": {"uvicorn"},
        "dev": {"pillow"},
        "crawler-poc": {"scrapling", "scrapy"},
    }
    roots = {
        root
        for item in contract["runtime_dependencies"]
        for root in item["import_roots"]
    }
    roots.update(contract["allowed_transitive_import_roots"])
    roots.add("mystery_runtime")

    violations = _BUILDER._validate_dependencies(
        contract=contract,
        requirements=requirements,
        optional_groups=optional_groups,
        external_import_roots=tuple(sorted(roots)),
    )

    assert any("unclassified external import roots: mystery_runtime" in item for item in violations)


def test_repository_path_rejects_escape() -> None:
    with pytest.raises(ValueError, match="escapes root"):
        _BUILDER._repository_path(_REPOSITORY_ROOT, "../outside.json")


def test_output_path_rejects_escape() -> None:
    with pytest.raises(ValueError, match="must stay inside the repository"):
        _BUILDER._resolve_output_path(_REPOSITORY_ROOT, Path("../outside.json"))


def test_contract_validator_fails_closed_for_unknown_fields() -> None:
    contract = json.loads(
        (_REPOSITORY_ROOT / "contracts" / "api-serverless-runtime.v1.json").read_text(
            encoding="utf-8"
        )
    )
    contract["unknown"] = True

    assert "contract contains unknown field: unknown" in _BUILDER._validate_contract(contract)


def test_missing_runtime_contract_fails_closed(tmp_path: Path) -> None:
    contract = json.loads(
        (_REPOSITORY_ROOT / "contracts" / "api-serverless-runtime.v1.json").read_text(
            encoding="utf-8"
        )
    )
    contract["entrypoint"]["file"] = "services/api/missing.py"
    contract_path = tmp_path / "contract.json"
    contract_path.write_text(json.dumps(contract), encoding="utf-8")

    with pytest.raises(ServerlessClosureError) as captured:
        build_serverless_closure(
            repository_root=_REPOSITORY_ROOT,
            contract_path=contract_path,
        )

    assert any("serverless entrypoint does not exist" in item for item in captured.value.violations)
