from app.db import session as db_session


def test_normalize_database_url_uses_psycopg_driver():
    assert (
        db_session.normalize_database_url("postgres://user:pass@example.test/postgres")
        == "postgresql+psycopg://user:pass@example.test/postgres"
    )
    assert (
        db_session.normalize_database_url("postgresql://user:pass@example.test/postgres")
        == "postgresql+psycopg://user:pass@example.test/postgres"
    )


def test_supabase_pooler_uses_null_pool(monkeypatch):
    captured: dict[str, object] = {}

    def fake_create_engine(url: str, **options):
        captured["url"] = url
        captured["options"] = options
        return object()

    def fake_sessionmaker(**options):
        captured["sessionmaker"] = options
        return object()

    monkeypatch.setattr(db_session, "create_engine", fake_create_engine)
    monkeypatch.setattr(db_session, "sessionmaker", fake_sessionmaker)

    db_session.configure_database(
        "postgresql://user:pass@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
    )

    assert captured["url"] == (
        "postgresql+psycopg://user:pass@"
        "aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
    )
    assert captured["options"] == {
        "pool_pre_ping": True,
        "future": True,
        "poolclass": db_session.NullPool,
    }
