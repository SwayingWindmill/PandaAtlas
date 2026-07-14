from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import HTTPException

from app.schemas.panda import ImportJobCreate, ImportSourceOption
from app.services import import_service


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
