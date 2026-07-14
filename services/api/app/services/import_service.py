import json
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from uuid import UUID, uuid4

from fastapi import HTTPException

try:
    import psycopg
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    psycopg = None

try:
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    text = None

    class SQLAlchemyError(Exception):
        """Fallback error when SQLAlchemy is not installed."""


from app.core.config import settings
from app.data.import_sources import list_import_sources as list_catalog_import_sources
from app.data.import_sources import resolve_import_source
from app.db.session import has_database, session_scope
from app.schemas.panda import (
    ImportJob,
    ImportJobCreate,
    ImportJobSummary,
    ImportSourceList,
    ImportSourceOption,
)

# Temporary in-memory store for scaffold stage.
IMPORT_JOBS: dict[UUID, ImportJob] = {}
IMPORT_JOBS_LOCK = RLock()


def list_import_sources() -> ImportSourceList:
    return ImportSourceList(items=list_catalog_import_sources())


def _parse_summary(value: object) -> ImportJobSummary:
    if isinstance(value, ImportJobSummary):
        return value

    if isinstance(value, dict):
        return ImportJobSummary.model_validate(value)

    if isinstance(value, str):
        try:
            loaded = json.loads(value)
        except json.JSONDecodeError:
            return ImportJobSummary()
        return ImportJobSummary.model_validate(loaded)

    return ImportJobSummary()


def _job_from_row(row: object) -> ImportJob:
    if not isinstance(row, dict):
        raise SQLAlchemyError("Unexpected row format")

    return ImportJob(
        id=row["id"],
        source_name=row["source_name"],
        source_uri=row["source_uri"],
        status=row["status"],
        summary=_parse_summary(row["summary"]),
        error_log=row["error_log"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        created_at=row["created_at"],
    )


def _repo_root_dir() -> Path:
    return Path(__file__).resolve().parents[4]


def _normalize_psycopg_dsn(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    return database_url


def _normalize_error_detail(err: Exception) -> str:
    message = " ".join(str(err).split()).strip()
    return message or err.__class__.__name__


def _build_summary(
    *,
    source: ImportSourceOption,
    mode: str,
    rows_total: int,
    rows_success: int,
    rows_failed: int,
    failure_reason: str | None = None,
) -> ImportJobSummary:
    return ImportJobSummary(
        rows_total=rows_total,
        rows_success=rows_success,
        rows_failed=rows_failed,
        source_name=source.name,
        source_path=source.source_path,
        mode=mode,
        failure_reason=failure_reason,
    )


def _resolve_source_path(source_name: str) -> tuple[ImportSourceOption, Path]:
    source = resolve_import_source(source_name)
    if source is None:
        raise HTTPException(status_code=422, detail=f"Import source is not approved: {source_name}")

    root_dir = _repo_root_dir()
    resolved = (root_dir / source.source_path).resolve()
    if not resolved.is_relative_to(root_dir):
        raise RuntimeError("Approved import source resolved outside the repository directory")

    if resolved.suffix.lower() != ".sql":
        raise RuntimeError("Approved import sources must be SQL files")

    if not resolved.exists() or not resolved.is_file():
        raise FileNotFoundError(f"Approved import source file is missing: {source.source_path}")

    return source, resolved


def _execute_sql_file(sql_path: Path) -> None:
    if psycopg is None:
        raise RuntimeError("psycopg is required to execute import SQL")

    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required for import execution")

    sql = sql_path.read_text(encoding="utf-8").lstrip("\ufeff")
    dsn = _normalize_psycopg_dsn(settings.database_url)

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql)
        conn.commit()


def _assert_job_runnable(job: ImportJob) -> None:
    if job.status == "running":
        raise HTTPException(status_code=409, detail="Import job is already running")
    if job.status == "succeeded":
        raise HTTPException(
            status_code=409,
            detail="Import job has already completed successfully",
        )


def _create_import_job_in_memory(payload: ImportJobCreate) -> ImportJob:
    source, _ = _resolve_source_path(payload.source_name)
    now = datetime.now(UTC)
    job = ImportJob(
        id=uuid4(),
        source_name=source.name,
        source_uri=None,
        status="queued",
        summary=_build_summary(
            source=source,
            mode="mock",
            rows_total=0,
            rows_success=0,
            rows_failed=0,
        ),
        created_at=now,
    )
    with IMPORT_JOBS_LOCK:
        IMPORT_JOBS[job.id] = job
    return job


def _get_import_job_in_memory(job_id: UUID) -> ImportJob:
    with IMPORT_JOBS_LOCK:
        job = IMPORT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job


def _run_import_job_in_memory(job_id: UUID) -> ImportJob:
    with IMPORT_JOBS_LOCK:
        return _run_import_job_in_memory_locked(job_id)


def _run_import_job_in_memory_locked(job_id: UUID) -> ImportJob:
    existing = _get_import_job_in_memory(job_id)
    _assert_job_runnable(existing)

    source, source_path = _resolve_source_path(existing.source_name)
    started_at = datetime.now(UTC)
    running = existing.model_copy(
        update={
            "status": "running",
            "summary": _build_summary(
                source=source,
                mode="mock",
                rows_total=0,
                rows_success=0,
                rows_failed=0,
            ),
            "error_log": None,
            "started_at": started_at,
            "finished_at": None,
        }
    )
    IMPORT_JOBS[job_id] = running

    try:
        _ = source_path.read_text(encoding="utf-8")
    except Exception as err:
        failure_reason = _normalize_error_detail(err)
        failed = running.model_copy(
            update={
                "status": "failed",
                "summary": _build_summary(
                    source=source,
                    mode="mock",
                    rows_total=1,
                    rows_success=0,
                    rows_failed=1,
                    failure_reason=failure_reason,
                ),
                "error_log": failure_reason,
                "finished_at": datetime.now(UTC),
            }
        )
        IMPORT_JOBS[job_id] = failed
        return failed

    succeeded = running.model_copy(
        update={
            "status": "succeeded",
            "summary": _build_summary(
                source=source,
                mode="mock",
                rows_total=1,
                rows_success=1,
                rows_failed=0,
            ),
            "finished_at": datetime.now(UTC),
        }
    )
    IMPORT_JOBS[job_id] = succeeded
    return succeeded


def _create_import_job_in_db(payload: ImportJobCreate) -> ImportJob:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    source, _ = _resolve_source_path(payload.source_name)
    summary = _build_summary(
        source=source,
        mode="database",
        rows_total=0,
        rows_success=0,
        rows_failed=0,
    )
    sql = text(
        """
        insert into public.admin_import_jobs (
          source_name,
          source_uri,
          status,
          summary
        ) values (
          :source_name,
          :source_uri,
          'queued'::public.import_job_status,
          cast(:summary as jsonb)
        )
        returning
          id,
          source_name,
          source_uri,
          status::text as status,
          summary,
          error_log,
          started_at,
          finished_at,
          created_at
        """
    )

    params = {
        "source_name": source.name,
        "source_uri": None,
        "summary": json.dumps(summary.model_dump()),
    }

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(sql, params).mappings().one()
        session.commit()

    return _job_from_row(dict(row))


def _get_import_job_from_db(job_id: UUID) -> ImportJob:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    sql = text(
        """
        select
          id,
          source_name,
          source_uri,
          status::text as status,
          summary,
          error_log,
          started_at,
          finished_at,
          created_at
        from public.admin_import_jobs
        where id = :job_id
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(sql, {"job_id": job_id}).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="Import job not found")

    return _job_from_row(dict(row))


def _update_import_job_in_db(
    *,
    job_id: UUID,
    status: str,
    summary: ImportJobSummary,
    error_log: str | None,
    started_at: datetime | None,
    finished_at: datetime | None,
) -> ImportJob:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    sql = text(
        """
        update public.admin_import_jobs
        set
          status = cast(:status as public.import_job_status),
          summary = cast(:summary as jsonb),
          error_log = :error_log,
          started_at = :started_at,
          finished_at = :finished_at
        where id = :job_id
        returning
          id,
          source_name,
          source_uri,
          status::text as status,
          summary,
          error_log,
          started_at,
          finished_at,
          created_at
        """
    )

    params = {
        "job_id": job_id,
        "status": status,
        "summary": json.dumps(summary.model_dump()),
        "error_log": error_log,
        "started_at": started_at,
        "finished_at": finished_at,
    }

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(sql, params).mappings().one()
        session.commit()

    return _job_from_row(dict(row))


def _claim_import_job_in_db(
    *,
    job_id: UUID,
    source: ImportSourceOption,
    started_at: datetime,
) -> ImportJob:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    summary = _build_summary(
        source=source,
        mode="database",
        rows_total=0,
        rows_success=0,
        rows_failed=0,
    )
    sql = text(
        """
        update public.admin_import_jobs
        set
          status = 'running'::public.import_job_status,
          summary = cast(:summary as jsonb),
          error_log = null,
          started_at = :started_at,
          finished_at = null
        where id = :job_id
          and status in ('queued'::public.import_job_status, 'failed'::public.import_job_status)
        returning
          id,
          source_name,
          source_uri,
          status::text as status,
          summary,
          error_log,
          started_at,
          finished_at,
          created_at
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(
            sql,
            {
                "job_id": job_id,
                "summary": json.dumps(summary.model_dump()),
                "started_at": started_at,
            },
        ).mappings().first()
        if row is not None:
            session.commit()

    if row is None:
        current = _get_import_job_from_db(job_id)
        _assert_job_runnable(current)
        raise HTTPException(status_code=409, detail="Import job could not be claimed")

    return _job_from_row(dict(row))


def _run_import_job_in_db(job_id: UUID) -> ImportJob:
    existing = _get_import_job_from_db(job_id)
    source, source_path = _resolve_source_path(existing.source_name)
    started_at = datetime.now(UTC)
    _claim_import_job_in_db(
        job_id=job_id,
        source=source,
        started_at=started_at,
    )

    try:
        _execute_sql_file(source_path)
    except Exception as err:
        failure_reason = _normalize_error_detail(err)
        return _update_import_job_in_db(
            job_id=job_id,
            status="failed",
            summary=_build_summary(
                source=source,
                mode="database",
                rows_total=1,
                rows_success=0,
                rows_failed=1,
                failure_reason=failure_reason,
            ),
            error_log=failure_reason,
            started_at=started_at,
            finished_at=datetime.now(UTC),
        )

    return _update_import_job_in_db(
        job_id=job_id,
        status="succeeded",
        summary=_build_summary(
            source=source,
            mode="database",
            rows_total=1,
            rows_success=1,
            rows_failed=0,
        ),
        error_log=None,
        started_at=started_at,
        finished_at=datetime.now(UTC),
    )


def create_import_job(payload: ImportJobCreate) -> ImportJob:
    if has_database():
        try:
            return _create_import_job_in_db(payload)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _create_import_job_in_memory(payload)


def get_import_job(job_id: UUID) -> ImportJob:
    if has_database():
        try:
            return _get_import_job_from_db(job_id)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _get_import_job_in_memory(job_id)


def run_import_job(job_id: UUID) -> ImportJob:
    if has_database():
        try:
            return _run_import_job_in_db(job_id)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _run_import_job_in_memory(job_id)
