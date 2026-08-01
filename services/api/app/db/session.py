from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
    from sqlalchemy.orm import Session, sessionmaker
    from sqlalchemy.pool import NullPool

    SQLALCHEMY_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    create_engine = None
    text = None
    sessionmaker = None
    NullPool = None

    class SQLAlchemyError(Exception):
        """Fallback error when SQLAlchemy is not installed."""

    class Session:  # type: ignore[override]
        pass

    SQLALCHEMY_AVAILABLE = False

SessionFactory = Any

_engine = None
_session_factory: SessionFactory | None = None


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def configure_database(database_url: str | None) -> None:
    global _engine, _session_factory

    if not database_url or not SQLALCHEMY_AVAILABLE:
        _engine = None
        _session_factory = None
        return

    normalized_url = normalize_database_url(database_url)
    engine_options: dict[str, Any] = {"pool_pre_ping": True, "future": True}
    if "pooler.supabase.com" in normalized_url and NullPool is not None:
        engine_options["poolclass"] = NullPool

    _engine = create_engine(normalized_url, **engine_options)
    _session_factory = sessionmaker(
        bind=_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def has_database() -> bool:
    return _session_factory is not None


def database_health() -> str:
    if not SQLALCHEMY_AVAILABLE:
        return "driver_missing"

    if not has_database():
        return "disabled"

    try:
        with session_scope() as session:
            if session is None:
                return "disabled"
            session.execute(text("select 1"))
        return "ok"
    except SQLAlchemyError:
        return "error"


@contextmanager
def session_scope() -> Iterator[Session | None]:
    if _session_factory is None:
        yield None
        return

    session = _session_factory()
    try:
        yield session
    finally:
        session.close()
