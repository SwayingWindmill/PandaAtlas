from pathlib import Path

from scripts.check_seedless_release_foundation import expected_migrations


def test_expected_migrations_supports_non_contiguous_versions(tmp_path: Path) -> None:
    (tmp_path / "0001_initial.sql").write_text("select 1;\n", encoding="utf-8")
    (tmp_path / "0026_moderation.sql").write_text("select 1;\n", encoding="utf-8")
    (tmp_path / "0031_audit.sql").write_text("select 1;\n", encoding="utf-8")

    assert expected_migrations(tmp_path) == ("0001", "0026", "0031")


def test_expected_migrations_ignores_non_sql_and_invalid_names(tmp_path: Path) -> None:
    (tmp_path / "0001_initial.sql").write_text("select 1;\n", encoding="utf-8")
    (tmp_path / "0002_notes.txt").write_text("not a migration\n", encoding="utf-8")
    (tmp_path / "README.sql").write_text("not a migration\n", encoding="utf-8")
    (tmp_path / "draft.sql").write_text("not a migration\n", encoding="utf-8")

    assert expected_migrations(tmp_path) == ("0001",)
