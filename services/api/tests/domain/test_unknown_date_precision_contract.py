from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
MIGRATION = REPO_ROOT / "infra" / "supabase" / "migrations" / "0039_unknown_date_precision.sql"


def test_unknown_precision_is_supported_without_inventing_calendar_precision() -> None:
    migration = MIGRATION.read_text(encoding="utf-8")
    residency_source = (
        REPO_ROOT / "services" / "api" / "app" / "domain" / "archive_residency.py"
    ).read_text(encoding="utf-8")
    admin_schema_source = (
        REPO_ROOT / "services" / "api" / "app" / "schemas" / "admin_content.py"
    ).read_text(encoding="utf-8")

    assert "('day', 'month', 'year', 'unknown')" in migration
    assert 'Literal["day", "month", "year", "unknown"]' in residency_source
    assert 'event_date_precision: Literal["day", "month", "year", "unknown"]' in admin_schema_source
