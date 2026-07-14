from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.panda import ImportJobCreate, ImportSourceOption
from app.services import import_service


class _Result:
    def __init__(self, row: dict[str, object] | None) -> None:
        self.row = row

    def mappings(self) -> "_Result":
        return self

    def first(self) -> dict[str, object] | None:
        return self.row

    def one(self) -> dict[str, object]:
        assert self.row is not None
        return self.row


class _Session:
    def __init__(self, rows: list[dict[str, object] | None]) -> None:
        self.rows = rows

    def execute(self, _statement: object, _params: object = None) -> _Result:
        return _Result(self.rows.pop(0))

    def commit(self) -> None:
        return None


class _SessionContext:
    def __init__(self, session: _Session) -> None:
        self.session = session

    def __enter__(self) -> _Session:
        return self.session

    def __exit__(self, *_args: object) -> None:
        return None


def _job_row(*, job_id: object, status: str) -> dict[str, object]:
    now = datetime.now(UTC)
    return {
        "id": job_id,
        "source_name": "approved.sql",
        "source_uri": None,
        "status": status,
        "summary": {},
        "error_log": None,
        "started_at": now if status != "queued" else None,
        "finished_at": now if status in {"succeeded", "failed"} else None,
        "created_at": now,
    }


def test_in_memory_import_job_can_only_run_once_concurrently(
    monkeypatch,
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "approved.sql"
    source_path.write_text("select 1;", encoding="utf-8")
    source = ImportSourceOption(
        name="approved.sql",
        label="Approved test source",
        source_path="approved.sql",
    )
    monkeypatch.setattr(
        import_service,
        "_resolve_source_path",
        lambda _source_name: (source, source_path),
    )
    monkeypatch.setattr(import_service, "has_database", lambda: False)

    with import_service.IMPORT_JOBS_LOCK:
        import_service.IMPORT_JOBS.clear()

    job = import_service.create_import_job(ImportJobCreate(source_name=source.name))

    def run_once() -> tuple[str, str | int]:
        try:
            result = import_service.run_import_job(job.id)
            return ("ok", result.status)
        except HTTPException as exc:
            return ("error", exc.status_code)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _index: run_once(), range(2)))

    assert results.count(("ok", "succeeded")) == 1
    assert results.count(("error", 409)) == 1


def test_database_import_job_claim_completes_once(
    monkeypatch,
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "approved.sql"
    source_path.write_text("select 1;", encoding="utf-8")
    source = ImportSourceOption(
        name="approved.sql",
        label="Approved test source",
        source_path="approved.sql",
    )
    job_id = uuid4()
    session = _Session(
        [
            _job_row(job_id=job_id, status="queued"),
            _job_row(job_id=job_id, status="running"),
            _job_row(job_id=job_id, status="succeeded"),
        ]
    )
    monkeypatch.setattr(import_service, "has_database", lambda: True)
    monkeypatch.setattr(
        import_service,
        "session_scope",
        lambda: _SessionContext(session),
    )
    monkeypatch.setattr(
        import_service,
        "_resolve_source_path",
        lambda _source_name: (source, source_path),
    )
    monkeypatch.setattr(import_service, "_execute_sql_file", lambda _path: None)

    result = import_service.run_import_job(job_id)

    assert result.status == "succeeded"


def test_database_import_job_rejects_an_already_claimed_job(
    monkeypatch,
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "approved.sql"
    source_path.write_text("select 1;", encoding="utf-8")
    source = ImportSourceOption(
        name="approved.sql",
        label="Approved test source",
        source_path="approved.sql",
    )
    job_id = uuid4()
    session = _Session(
        [
            _job_row(job_id=job_id, status="queued"),
            None,
            _job_row(job_id=job_id, status="running"),
        ]
    )
    monkeypatch.setattr(import_service, "has_database", lambda: True)
    monkeypatch.setattr(
        import_service,
        "session_scope",
        lambda: _SessionContext(session),
    )
    monkeypatch.setattr(
        import_service,
        "_resolve_source_path",
        lambda _source_name: (source, source_path),
    )

    with pytest.raises(HTTPException) as exc_info:
        import_service.run_import_job(job_id)

    assert exc_info.value.status_code == 409
