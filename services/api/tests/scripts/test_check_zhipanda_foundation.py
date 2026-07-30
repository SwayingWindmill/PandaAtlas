from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.check_zhipanda_foundation import (
    FoundationCheckError,
    expected_migration_versions,
    parse_version,
    redact_database_url,
    run_foundation_preflight,
    static_configuration_evidence,
)

REPO_ROOT = Path(__file__).resolve().parents[4]


def test_static_foundation_configuration_is_pinned_and_private() -> None:
    evidence = static_configuration_evidence(REPO_ROOT)

    assert evidence["project_id"] == "panda-atlas"
    assert evidence["postgres_major"] == 17
    assert evidence["supabase_cli"] == "2.110.0"
    assert "activity" not in evidence["api_schemas"]
    assert "engagement" not in evidence["api_schemas"]
    assert "feed" not in evidence["api_schemas"]
    assert "identity" not in evidence["api_schemas"]
    assert "integration" not in evidence["api_schemas"]
    assert "notification" not in evidence["api_schemas"]
    assert "pgmq" not in evidence["api_schemas"]
    assert "storage" not in evidence["api_schemas"]
    assert evidence["migration_versions"][-1] == "0014"


def test_version_and_database_url_helpers_are_deterministic() -> None:
    assert parse_version("1.5.1") == (1, 5, 1)
    assert parse_version("17.6 (Supabase)") == (17, 6)
    assert redact_database_url(
        "postgresql+psycopg://postgres:private-value@127.0.0.1:54322/postgres"
    ) == "postgresql://postgres@127.0.0.1:54322/postgres"
    assert expected_migration_versions(REPO_ROOT) == [
        "0001",
        "0002",
        "0003",
        "0004",
        "0005",
        "0006",
        "0007",
        "0008",
        "0009",
        "0010",
        "0011",
        "0012",
        "0013",
        "0014",
    ]


def test_static_configuration_fails_when_a_private_schema_is_exposed(tmp_path: Path) -> None:
    (tmp_path / "infra" / "supabase" / "migrations").mkdir(parents=True)
    (tmp_path / "infra" / "supabase" / "migrations" / "0001_test.sql").write_text(
        "select 1;\n", encoding="utf-8"
    )
    (tmp_path / "infra" / "supabase" / "config.toml").write_text(
        """
project_id = "panda-atlas"
[api]
schemas = ["public", "pgmq"]
auto_expose_new_tables = false
[db]
major_version = 17
[db.seed]
sql_paths = ["./seed/*.sql"]
[auth]
enabled = true
[storage]
enabled = true
""".strip(),
        encoding="utf-8",
    )
    (tmp_path / "package.json").write_text(
        json.dumps({"devDependencies": {"supabase": "2.110.0"}}), encoding="utf-8"
    )
    (tmp_path / "docker-compose.yml").write_text(
        "ADMIN_API_TOKEN: ${ADMIN_API_TOKEN:?required}\n", encoding="utf-8"
    )

    with pytest.raises(FoundationCheckError, match="Private schemas exposed"):
        static_configuration_evidence(tmp_path)


def test_preflight_report_fails_closed_and_redacts_credentials(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    import scripts.check_zhipanda_foundation as foundation

    monkeypatch.setattr(foundation, "static_configuration_evidence", lambda root: {"ok": True})
    monkeypatch.setattr(foundation, "_fetch_service_health", lambda api_url: {"auth": 200})

    def fail_database(database_url: str, root: Path) -> dict[str, object]:
        raise FoundationCheckError("pgmq is missing")

    monkeypatch.setattr(foundation, "database_evidence", fail_database)
    report_path = tmp_path / "foundation.json"

    report = run_foundation_preflight(
        database_url="postgresql://postgres:private-value@localhost:54322/postgres",
        api_url="http://localhost:54321",
        report_path=report_path,
        root=tmp_path,
    )

    assert report["outcome"] == "failed"
    assert report["environment"]["database_url"] == (
        "postgresql://postgres@localhost:54322/postgres"
    )
    assert report["checks"][-1] == {
        "id": "database-extensions-migrations-and-queue",
        "status": "failed",
        "detail": "pgmq is missing",
    }
    assert json.loads(report_path.read_text(encoding="utf-8")) == report
