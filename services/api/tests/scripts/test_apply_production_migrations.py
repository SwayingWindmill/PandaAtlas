import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "apply_production_migrations.py"
SPEC = spec_from_file_location("apply_production_migrations", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_collect_migrations_orders_versions_and_strips_bom(tmp_path: Path) -> None:
    (tmp_path / "0002_second.sql").write_text("select 2;", encoding="utf-8")
    (tmp_path / "0001_first.sql").write_text("\ufeffselect 1;", encoding="utf-8")

    migrations = MODULE.collect_migrations(tmp_path)

    assert [migration.version for migration in migrations] == ["0001", "0002"]
    assert migrations[0].sql == "select 1;"
    assert migrations[0].checksum == MODULE.migration_checksum("select 1;")


def test_collect_migrations_rejects_noncanonical_filename(tmp_path: Path) -> None:
    (tmp_path / "1_bad.sql").write_text("select 1;", encoding="utf-8")

    with pytest.raises(ValueError, match="Invalid production migration filename"):
        MODULE.collect_migrations(tmp_path)


def test_checksum_from_statements_reads_zhipanda_marker() -> None:
    checksum = "a" * 64

    assert MODULE.checksum_from_statements([f"{MODULE.CHECKSUM_PREFIX}{checksum}"]) == checksum
    assert MODULE.checksum_from_statements(["select 1;"]) is None


def test_normalize_database_url_removes_sqlalchemy_driver_name() -> None:
    assert (
        MODULE.normalize_database_url("postgresql+psycopg://user:pass@db:5432/postgres")
        == "postgresql://user:pass@db:5432/postgres"
    )


def test_read_boolean_environment_is_strict(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIGRATION_ADOPT_LEGACY_HISTORY", raising=False)
    assert MODULE.read_boolean_environment("MIGRATION_ADOPT_LEGACY_HISTORY") is False

    monkeypatch.setenv("MIGRATION_ADOPT_LEGACY_HISTORY", "true")
    assert MODULE.read_boolean_environment("MIGRATION_ADOPT_LEGACY_HISTORY") is True

    monkeypatch.setenv("MIGRATION_ADOPT_LEGACY_HISTORY", "yes")
    with pytest.raises(RuntimeError, match="must be true or false"):
        MODULE.read_boolean_environment("MIGRATION_ADOPT_LEGACY_HISTORY")


class FakeCursor:
    def __init__(self) -> None:
        self.executions: list[tuple[str, object | None]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, sql: str, params: object | None = None) -> None:
        self.executions.append((sql, params))


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()
        self.commits = 0
        self.rollbacks = 0

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


def test_legacy_migration_history_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    migration = MODULE.Migration("0001", "first", Path("0001_first.sql"), "select 1;", "abc")
    connection = FakeConnection()
    monkeypatch.setattr(MODULE, "ensure_history_table", lambda _connection: None)
    monkeypatch.setattr(
        MODULE,
        "read_applied_migrations",
        lambda _connection: {"0001": ("first", ["select 1;"])},
    )

    with pytest.raises(RuntimeError, match="has no ZhiPanda checksum"):
        MODULE.apply_migrations(connection, [migration])


def test_legacy_migration_history_requires_explicit_adoption(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    migration = MODULE.Migration("0001", "first", Path("0001_first.sql"), "select 1;", "abc")
    connection = FakeConnection()
    monkeypatch.setattr(MODULE, "ensure_history_table", lambda _connection: None)
    monkeypatch.setattr(
        MODULE,
        "read_applied_migrations",
        lambda _connection: {"0001": ("first", ["select 1;"])},
    )

    result = MODULE.apply_migrations(connection, [migration], adopt_legacy_history=True)

    assert result.newly_applied == ()
    assert result.adopted_legacy == ("0001",)
    assert connection.commits == 1
    assert any(
        "update supabase_migrations.schema_migrations" in sql
        for sql, _ in connection.cursor_instance.executions
    )
