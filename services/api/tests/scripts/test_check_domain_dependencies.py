from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_CHECKER_PATH = _SERVICE_ROOT / "scripts" / "check_domain_dependencies.py"
_SPEC = importlib.util.spec_from_file_location("check_domain_dependencies", _CHECKER_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_CHECKER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _CHECKER
_SPEC.loader.exec_module(_CHECKER)

DomainDependencyError = _CHECKER.DomainDependencyError
analyze_domain_dependencies = _CHECKER.analyze_domain_dependencies


def _write_file(root: Path, relative_path: str, content: str = "") -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _contract(*, cycle: bool = False) -> dict[str, object]:
    return {
        "schema_version": 1,
        "service_root": "services/api",
        "application_package": "app",
        "api_prefixes": ["app.api"],
        "domains": {
            "archive": {
                "root": "app.archive",
                "may_depend_on": ["identity"],
                "public_surfaces": ["public", "events", "schemas"],
                "api_surfaces": ["public", "schemas"],
            },
            "identity": {
                "root": "app.identity",
                "may_depend_on": ["archive"] if cycle else [],
                "public_surfaces": ["public", "events", "schemas"],
                "api_surfaces": ["public", "schemas"],
            },
        },
        "rules": {
            "forbid_dynamic_imports": True,
            "forbid_domain_to_api_imports": True,
            "reject_dependency_cycles": True,
        },
    }


def _write_fixture(root: Path, *, contract: dict[str, object] | None = None) -> Path:
    contract_path = root / "contracts" / "api-domain-dependencies.v1.json"
    _write_file(
        root,
        "contracts/api-domain-dependencies.v1.json",
        json.dumps(contract or _contract()),
    )
    for package in (
        "services/api/app/__init__.py",
        "services/api/app/api/__init__.py",
        "services/api/app/archive/__init__.py",
        "services/api/app/identity/__init__.py",
    ):
        _write_file(root, package)
    _write_file(
        root,
        "services/api/app/archive/public.py",
        "from app.identity.public import IdentityRead\n",
    )
    _write_file(root, "services/api/app/archive/schemas.py", "")
    _write_file(root, "services/api/app/archive/private.py", "")
    _write_file(root, "services/api/app/identity/public.py", "class IdentityRead: ...\n")
    _write_file(root, "services/api/app/identity/schemas.py", "")
    _write_file(root, "services/api/app/identity/private.py", "")
    _write_file(
        root,
        "services/api/app/api/routes.py",
        (
            "from app.archive.schemas import ArchiveRead\n"
            "from app.identity.public import IdentityRead\n"
        ),
    )
    return contract_path


def test_accepts_declared_api_and_cross_domain_surfaces(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path)

    report = analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert report.domains == ("archive", "identity")
    assert report.domain_edges == ("archive -> identity",)
    assert "app.api.routes -> app.archive.schemas" in report.api_imports


def test_rejects_api_import_of_private_domain_surface(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path)
    _write_file(
        tmp_path,
        "services/api/app/api/routes.py",
        "from app.archive.private import secret\n",
    )

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert any(
        "API import reaches private surface of archive" in item
        for item in captured.value.violations
    )


def test_rejects_undeclared_cross_domain_dependency(tmp_path: Path) -> None:
    contract = _contract()
    contract["domains"]["archive"]["may_depend_on"] = []  # type: ignore[index]
    contract_path = _write_fixture(tmp_path, contract=contract)

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert any(
        "undeclared domain dependency archive -> identity" in item
        for item in captured.value.violations
    )


def test_rejects_cross_domain_private_surface(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path)
    _write_file(
        root=tmp_path,
        relative_path="services/api/app/archive/public.py",
        content="from app.identity.private import secret\n",
    )

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert any(
        "domain dependency reaches private surface of identity" in item
        for item in captured.value.violations
    )


def test_rejects_domain_import_of_api_layer(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path)
    _write_file(
        root=tmp_path,
        relative_path="services/api/app/archive/public.py",
        content="from app.api import routes\n",
    )

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert any(
        "domain archive must not import API module" in item
        for item in captured.value.violations
    )


def test_rejects_domain_dependency_cycle(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path, contract=_contract(cycle=True))
    _write_file(
        root=tmp_path,
        relative_path="services/api/app/identity/public.py",
        content="from app.archive.public import ArchiveRead\n",
    )

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert (
        "domain dependency cycle is forbidden: archive -> identity -> archive"
        in captured.value.violations
    )


def test_rejects_dynamic_imports_in_guarded_modules(tmp_path: Path) -> None:
    contract_path = _write_fixture(tmp_path)
    _write_file(
        root=tmp_path,
        relative_path="services/api/app/archive/public.py",
        content=(
            "from importlib import import_module\n"
            "value = import_module('app.identity.public')\n"
        ),
    )

    with pytest.raises(DomainDependencyError) as captured:
        analyze_domain_dependencies(repository_root=tmp_path, contract_path=contract_path)

    assert any("dynamic import through import_module" in item for item in captured.value.violations)


def test_repository_domain_dependency_contract() -> None:
    repository_root = _SERVICE_ROOT.parents[1]
    if not (repository_root / "services" / "api" / "app" / "api").is_dir():
        pytest.skip("repository application tree is not present in the isolated fixture")
    contract_path = repository_root / "contracts" / "api-domain-dependencies.v1.json"

    report = analyze_domain_dependencies(
        repository_root=repository_root,
        contract_path=contract_path,
    )

    assert report.domains == ("privacy_operations", "review_moderation")
