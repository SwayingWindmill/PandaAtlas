from app.core.config import Settings


def test_postgres_url_is_used_when_database_url_is_missing(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_URL", "postgresql://pooler.example/postgres")

    assert Settings(_env_file=None).database_url == "postgresql://pooler.example/postgres"


def test_database_url_takes_precedence_over_postgres_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://database.example/postgres")
    monkeypatch.setenv("POSTGRES_URL", "postgresql://pooler.example/postgres")

    assert Settings(_env_file=None).database_url == "postgresql://database.example/postgres"
