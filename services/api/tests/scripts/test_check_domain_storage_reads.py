from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_REPOSITORY_ROOT = _SERVICE_ROOT.parents[1]
_CHECKER_PATH = _SERVICE_ROOT / "scripts" / "check_domain_storage_reads.py"
_SPEC = importlib.util.spec_from_file_location(
    "check_domain_storage_reads",
    _CHECKER_PATH,
)
assert _SPEC is not None and _SPEC.loader is not None
_CHECKER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _CHECKER
_SPEC.loader.exec_module(_CHECKER)

DomainStorageReadError = _CHECKER.DomainStorageReadError
analyze_domain_storage_reads = _CHECKER.analyze_domain_storage_reads


def _write_file(root: Path, relative: str, content: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _contract() -> dict[str, object]:
    return {
        "schema_version": 1,
        "title": "fixture",
        "service_root": "services/api",
        "application_package": "app",
        "domains": {
            "moderation": {
                "root": "app.moderation",
                "owned_schemas": ["moderation"],
                "allowed_read_targets": ["identity.accounts"],
            }
        },
        "rules": {
            "require_schema_qualified_reads": True,
            "forbid_dynamic_read_targets": True,
        },
    }


def _write_fixture(
    tmp_path: Path,
    *,
    source: str,
    contract: dict[str, object] | None = None,
) -> Path:
    _write_file(tmp_path, "services/api/app/__init__.py", "")
    _write_file(tmp_path, "services/api/app/moderation/__init__.py", "")
    _write_file(tmp_path, "services/api/app/moderation/service.py", source)
    contract_path = tmp_path / "contracts" / "api-domain-storage-reads.v1.json"
    _write_file(
        tmp_path,
        "contracts/api-domain-storage-reads.v1.json",
        json.dumps(contract or _contract()),
    )
    return contract_path


def test_allows_owned_and_exact_cross_domain_reads(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "QUERY = text('''\n"
            "with local_actions as (\n"
            "  select * from moderation.actions\n"
            ")\n"
            "select account.account_id\n"
            "from local_actions action\n"
            "join identity.accounts account on account.account_id = action.account_id\n"
            "cross join lateral jsonb_array_elements(account.metadata) item\n"
            "''')\n"
            "DELETE = text('delete from moderation.actions where id in "
            "(select account_id from identity.accounts)')\n"
        ),
    )

    report = analyze_domain_storage_reads(
        repository_root=tmp_path,
        contract_path=contract_path,
    )

    assert {item.target for item in report.reads} == {
        "identity.accounts",
        "moderation.actions",
    }


def test_rejects_unapproved_cross_domain_read(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "QUERY = text('select * from audit.events')\n"
        ),
    )

    with pytest.raises(DomainStorageReadError) as captured:
        analyze_domain_storage_reads(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any("may not read audit.events" in item for item in captured.value.violations)


def test_rejects_unqualified_physical_read_target(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "QUERY = text('select * from actions')\n"
        ),
    )

    with pytest.raises(DomainStorageReadError) as captured:
        analyze_domain_storage_reads(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "must be schema-qualified: actions" in item
        for item in captured.value.violations
    )


def test_rejects_dynamic_read_target(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "def query(schema: str):\n"
            "    return text(f'select * from {schema}.actions')\n"
        ),
    )

    with pytest.raises(DomainStorageReadError) as captured:
        analyze_domain_storage_reads(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "dynamic SQL read target is forbidden" in item
        for item in captured.value.violations
    )


def test_rejects_overlapping_schema_ownership(tmp_path: Path) -> None:
    contract = _contract()
    domains = contract["domains"]
    assert isinstance(domains, dict)
    domains["identity"] = {
        "root": "app.identity",
        "owned_schemas": ["moderation"],
        "allowed_read_targets": [],
    }
    _write_file(tmp_path, "services/api/app/identity/__init__.py", "")
    contract_path = _write_fixture(
        tmp_path,
        source="from sqlalchemy import text\n",
        contract=contract,
    )

    with pytest.raises(DomainStorageReadError) as captured:
        analyze_domain_storage_reads(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any("owned by both" in item for item in captured.value.violations)


def test_repository_domain_storage_read_contract_passes() -> None:
    try:
        report = analyze_domain_storage_reads(repository_root=_REPOSITORY_ROOT)
    except DomainStorageReadError as error:
        pytest.fail("\n".join(error.violations))

    assert report.domains == ("privacy_operations", "review_moderation")
    assert report.modules
    assert report.reads
