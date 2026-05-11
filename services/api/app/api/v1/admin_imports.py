from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.security import require_admin_token
from app.schemas.panda import ImportJob, ImportJobCreate, ImportSourceList
from app.services.import_service import (
    create_import_job,
    get_import_job,
    list_import_sources,
    run_import_job,
)

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin_token)])


@router.get("/import-sources", response_model=ImportSourceList)
def list_import_sources_endpoint() -> ImportSourceList:
    return list_import_sources()


@router.post("/import-jobs", response_model=ImportJob, status_code=status.HTTP_201_CREATED)
def create_import_job_endpoint(payload: ImportJobCreate) -> ImportJob:
    return create_import_job(payload)


@router.get("/import-jobs/{job_id}", response_model=ImportJob)
def get_import_job_endpoint(job_id: UUID) -> ImportJob:
    return get_import_job(job_id)


@router.post("/import-jobs/{job_id}/run", response_model=ImportJob)
def run_import_job_endpoint(job_id: UUID) -> ImportJob:
    return run_import_job(job_id)
