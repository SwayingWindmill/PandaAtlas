import logging
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

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

logger = logging.getLogger(__name__)

_engine = None
_session_factory: SessionFactory | None = None

_NON_PSYCOPG_QUERY_OPTIONS = frozenset({"connection_limit", "pgbouncer", "supa"})


def normalize_database_url(database_url: str) -> str:
    normalized_url = database_url
    if normalized_url.startswith("postgres://"):
        normalized_url = normalized_url.replace(
            "postgres://", "postgresql+psycopg://", 1
        )
    elif normalized_url.startswith("postgresql://"):
        normalized_url = normalized_url.replace(
            "postgresql://", "postgresql+psycopg://", 1
        )

    parsed = urlsplit(normalized_url)
    query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key not in _NON_PSYCOPG_QUERY_OPTIONS
    ]
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )


def configure_database(database_url: str | None) -> None:
    global _engine, _session_factory

    if not database_url or not SQLALCHEMY_AVAILABLE:
        _engine = None
        _session_factory = None
        return

    normalized_url = normalize_database_url(database_url)
    parsed_url = urlsplit(normalized_url)
    engine_options: dict[str, Any] = {"pool_pre_ping": True, "future": True}
    is_supabase_pooler = parsed_url.hostname is not None and parsed_url.hostname.endswith(
        ".pooler.supabase.com"
    )
    if is_supabase_pooler and NullPool is not None:
        engine_options["poolclass"] = NullPool
    if is_supabase_pooler and parsed_url.port == 6543:
        engine_options["connect_args"] = {"prepare_threshold": None}

    _engine = create_engine(normalized_url, **engine_options)
    _session_factory = sessionmaker(
        bind=_engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def has_database() -> bool:
    return _session_factory is not None


def classify_database_error(error: SQLAlchemyError) -> str:
    original = getattr(error, "orig", None)
    sqlstate = getattr(original, "sqlstate", None)
    if isinstance(sqlstate, str) and sqlstate:
        return f"sqlstate_{sqlstate.lower()}"

    message = str(original or error).lower()
    categories = (
        ("password authentication failed", "authentication_failed"),
        ("invalid password", "authentication_failed"),
        ("network is unreachable", "network_unreachable"),
        ("connection refused", "connection_refused"),
        ("could not translate host name", "dns_error"),
        ("name or service not known", "dns_error"),
        ("timed out", "timeout"),
        ("timeout expired", "timeout"),
        ("invalid connection option", "invalid_connection_option"),
        ("connection terminated unexpectedly", "connection_terminated"),
        ("server closed the connection unexpectedly", "connection_terminated"),
    )
    for fragment, category in categories:
        if fragment in message:
            return category
    return type(original or error).__name__.lower()


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
    except SQLAlchemyError as error:
        logger.error("database health check failed: %s", classify_database_error(error))
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
