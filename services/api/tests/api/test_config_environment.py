import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_postgres_url_is_used_when_database_url_is_missing(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_URL", "postgresql://pooler.example/postgres")

    assert Settings(_env_file=None).database_url == "postgresql://pooler.example/postgres"


def test_database_url_takes_precedence_over_postgres_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://database.example/postgres")
    monkeypatch.setenv("POSTGRES_URL", "postgresql://pooler.example/postgres")

    assert Settings(_env_file=None).database_url == "postgresql://database.example/postgres"


def test_production_audit_requires_a_non_default_export_key(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("UNIFIED_AUDIT_ENABLED", "true")
    monkeypatch.delenv("AUDIT_EXPORT_ENCRYPTION_KEY", raising=False)

    with pytest.raises(ValidationError, match="AUDIT_EXPORT_ENCRYPTION_KEY"):
        Settings(_env_file=None)


def test_audit_export_key_must_be_independent(monkeypatch):
    shared_key = "independent-key-boundary-test-value-0001"
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("UNIFIED_AUDIT_ENABLED", "true")
    monkeypatch.setenv("AUDIT_EXPORT_ENCRYPTION_KEY", shared_key)
    monkeypatch.setenv("COMMUNITY_INTAKE_STORAGE_SIGNING_KEY", shared_key)

    with pytest.raises(ValidationError, match="must differ"):
        Settings(_env_file=None)

    monkeypatch.setenv(
        "COMMUNITY_INTAKE_STORAGE_SIGNING_KEY",
        "community-storage-boundary-test-value-0002",
    )
    assert Settings(_env_file=None).audit_export_encryption_key == shared_key
