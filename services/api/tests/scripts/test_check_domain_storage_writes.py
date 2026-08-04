from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

_SERVICE_ROOT = Path(__file__).resolve().parents[2]
_REPOSITORY_ROOT = _SERVICE_ROOT.parents[1]
_CHECKER_PATH = _SERVICE_ROOT / "scripts" / "check_domain_storage_writes.py"
_SPEC = importlib.util.spec_from_file_location("check_domain_storage_writes", _CHECKER_PATH)
assert _SPEC is not None and _SPEC.loader is not None
_CHECKER = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = _CHECKER
_SPEC.loader.exec_module(_CHECKER)

DomainStorageWriteError = _CHECKER.DomainStorageWriteError
analyze_domain_storage_writes = _CHECKER.analyze_domain_storage_writes


def _write_file(root: Path, relative_path: str, content: str) -> None:
    path = root / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _contract(
    *,
    allowed_write_targets: tuple[str, ...] = (),
) -> dict[str, object]:
    return {
        "schema_version": 1,
        "service_root": "services/api",
        "application_package": "app",
        "domains": {
            "moderation": {
                "root": "app.moderation",
                "owned_schemas": ["moderation"],
                "allowed_write_targets": list(allowed_write_targets),
            }
        },
        "rules": {
            "require_schema_qualified_writes": True,
            "forbid_dynamic_write_targets": True,
        },
    }


def _write_fixture(
    root: Path,
    *,
    source: str,
    allowed_write_targets: tuple[str, ...] = (),
) -> Path:
    contract_path = root / "contracts" / "api-domain-storage-writes.v1.json"
    _write_file(
        root,
        "contracts/api-domain-storage-writes.v1.json",
        json.dumps(_contract(allowed_write_targets=allowed_write_targets)),
    )
    _write_file(root, "services/api/app/__init__.py", "")
    _write_file(root, "services/api/app/moderation/__init__.py", "")
    _write_file(root, "services/api/app/moderation/service.py", source)
    return contract_path


def test_accepts_owned_schema_writes(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "STATEMENT = text('insert into moderation.actions (id) values (1)')\n"
        ),
    )

    report = analyze_domain_storage_writes(
        repository_root=tmp_path,
        contract_path=contract_path,
    )

    assert [item.target for item in report.writes] == ["moderation.actions"]


def test_accepts_explicit_cross_schema_write_target(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "STATEMENT = text('update identity.accounts set state = 1')\n"
        ),
        allowed_write_targets=("identity.accounts",),
    )

    report = analyze_domain_storage_writes(
        repository_root=tmp_path,
        contract_path=contract_path,
    )

    assert [item.target for item in report.writes] == ["identity.accounts"]


def test_rejects_another_table_in_an_approved_target_schema(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "STATEMENT = text('delete from identity.sessions where id = 1')\n"
        ),
        allowed_write_targets=("identity.accounts",),
    )

    with pytest.raises(DomainStorageWriteError) as captured:
        analyze_domain_storage_writes(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "may not delete from identity.sessions" in item
        for item in captured.value.violations
    )


def test_rejects_unapproved_cross_schema_writes(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "STATEMENT = text('delete from identity.accounts where id = 1')\n"
        ),
    )

    with pytest.raises(DomainStorageWriteError) as captured:
        analyze_domain_storage_writes(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "may not delete from identity.accounts" in item
        for item in captured.value.violations
    )


def test_rejects_unqualified_write_targets(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "STATEMENT = text('insert into actions (id) values (1)')\n"
        ),
    )

    with pytest.raises(DomainStorageWriteError) as captured:
        analyze_domain_storage_writes(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "must be schema-qualified: actions" in item
        for item in captured.value.violations
    )


def test_rejects_dynamic_write_targets(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "def statement(schema: str):\n"
            "    return text(f'update {schema}.actions set state = 1')\n"
        ),
    )

    with pytest.raises(DomainStorageWriteError) as captured:
        analyze_domain_storage_writes(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any(
        "dynamic SQL write target is forbidden" in item
        for item in captured.value.violations
    )


def test_ignores_locking_and_upsert_update_clauses(tmp_path: Path) -> None:
    contract_path = _write_fixture(
        tmp_path,
        source=(
            "from sqlalchemy import text\n\n"
            "LOCK = text('select id from moderation.actions for update of actions')\n"
            "UPSERT = text('insert into moderation.actions (id) values (1) "
            "on conflict (id) do update set id = excluded.id')\n"
        ),
    )

    report = analyze_domain_storage_writes(
        repository_root=tmp_path,
        contract_path=contract_path,
    )

    assert [item.target for item in report.writes] == ["moderation.actions"]


def test_rejects_overlapping_schema_ownership(tmp_path: Path) -> None:
    contract = _contract()
    domains = contract["domains"]
    assert isinstance(domains, dict)
    domains["identity"] = {
        "root": "app.identity",
        "owned_schemas": ["moderation"],
        "allowed_write_targets": [],
    }
    contract_path = tmp_path / "contracts" / "api-domain-storage-writes.v1.json"
    _write_file(
        tmp_path,
        "contracts/api-domain-storage-writes.v1.json",
        json.dumps(contract),
    )

    with pytest.raises(DomainStorageWriteError) as captured:
        analyze_domain_storage_writes(
            repository_root=tmp_path,
            contract_path=contract_path,
        )

    assert any("owned by both" in item for item in captured.value.violations)


def test_repository_domain_storage_write_contract_passes() -> None:
    try:
        report = analyze_domain_storage_writes(repository_root=_REPOSITORY_ROOT)
    except DomainStorageWriteError as error:
        pytest.fail("\n".join(error.violations), pytrace=False)

    assert set(report.domains) == {"privacy_operations", "review_moderation"}
    assert report.writes
    assert all(item.schema and item.table for item in report.writes)
