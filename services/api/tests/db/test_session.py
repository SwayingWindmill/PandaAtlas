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


def test_normalize_database_url_removes_non_psycopg_options():
    normalized = db_session.normalize_database_url(
        "postgres://user:pass@aws-0-ap-northeast-1.pooler.supabase.com:6543/"
        "postgres?sslmode=require&supa=base-pooler.x&pgbouncer=true&"
        "connection_limit=1&connect_timeout=15"
    )

    assert normalized == (
        "postgresql+psycopg://user:pass@"
        "aws-0-ap-northeast-1.pooler.supabase.com:6543/"
        "postgres?sslmode=require&connect_timeout=15"
    )


def test_supabase_transaction_pooler_uses_null_pool_and_disables_prepared_statements(
    monkeypatch,
):
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
        "postgresql://user:pass@aws-0-ap-northeast-1.pooler.supabase.com:6543/"
        "postgres?sslmode=require&supa=base-pooler.x"
    )

    assert captured["url"] == (
        "postgresql+psycopg://user:pass@"
        "aws-0-ap-northeast-1.pooler.supabase.com:6543/"
        "postgres?sslmode=require"
    )
    assert captured["options"] == {
        "pool_pre_ping": True,
        "future": True,
        "poolclass": db_session.NullPool,
        "connect_args": {"prepare_threshold": None},
    }


def test_supabase_session_pooler_uses_null_pool_without_prepared_statement_override(
    monkeypatch,
):
    captured: dict[str, object] = {}

    def fake_create_engine(url: str, **options):
        captured["url"] = url
        captured["options"] = options
        return object()

    monkeypatch.setattr(db_session, "create_engine", fake_create_engine)
    monkeypatch.setattr(db_session, "sessionmaker", lambda **options: object())

    db_session.configure_database(
        "postgresql://user:pass@aws-0-ap-northeast-1.pooler.supabase.com:5432/"
        "postgres?sslmode=require"
    )

    assert captured["options"] == {
        "pool_pre_ping": True,
        "future": True,
        "poolclass": db_session.NullPool,
    }


def test_database_error_classifier_prefers_sqlstate():
    class OriginalError(Exception):
        sqlstate = "28P01"

    class WrappedError(Exception):
        orig = OriginalError()

    assert (
        db_session.classify_database_error(WrappedError())  # type: ignore[arg-type]
        == "sqlstate_28p01"
    )


def test_database_error_classifier_redacts_authentication_details():
    class WrappedError(Exception):
        orig = Exception("password authentication failed for user sensitive-user")

    classification = db_session.classify_database_error(  # type: ignore[arg-type]
        WrappedError()
    )

    assert classification == "authentication_failed"
    assert "sensitive-user" not in classification


def test_database_error_classifier_handles_network_failure():
    class WrappedError(Exception):
        orig = Exception("Network is unreachable")

    assert (
        db_session.classify_database_error(WrappedError())  # type: ignore[arg-type]
        == "network_unreachable"
    )
