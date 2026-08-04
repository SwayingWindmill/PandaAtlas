from pathlib import Path

from check_seedless_release_foundation import expected_migrations


def test_expected_migrations_follow_tracked_sql_files(tmp_path: Path) -> None:
    (tmp_path / "0001_initial.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "0031_unified_audit.sql").write_text("select 1;", encoding="utf-8")
    (tmp_path / "README.md").write_text("not a migration", encoding="utf-8")

    assert expected_migrations(tmp_path) == ("0001", "0031")
