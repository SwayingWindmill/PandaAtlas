from pathlib import Path

from check_seedless_release_foundation import PRIVATE_SCHEMAS, expected_migrations


def test_expected_migrations_follow_tracked_sql_files(tmp_path: Path) -> None:
    (tmp_path / "0001_initial.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "0027_privacy_requests.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "0030_privacy_metrics.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "README.md").write_text("not a migration", encoding="utf-8")

    assert expected_migrations(tmp_path) == ("0001", "0027", "0030")


def test_privacy_schema_is_denied_to_browser_roles() -> None:
    assert "privacy" in PRIVATE_SCHEMAS
