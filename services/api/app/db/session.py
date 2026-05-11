from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import SQLAlchemyError
    from sqlalchemy.orm import Session, sessionmaker

    SQLALCHEMY_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    create_engine = None
    text = None
    sessionmaker = None

    class SQLAlchemyError(Exception):
        """Fallback error when SQLAlchemy is not installed."""

    class Session:  # type: ignore[override]
        pass

    SQLALCHEMY_AVAILABLE = False

SessionFactory = Any

_engine = None
_session_factory: SessionFactory | None = None


def configure_database(database_url: str | None) -> None:
    global _engine, _session_factory

    if not database_url or not SQLALCHEMY_AVAILABLE:
        _engine = None
        _session_factory = None
        return

    _engine = create_engine(database_url, pool_pre_ping=True, future=True)
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
