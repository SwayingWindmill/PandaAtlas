from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.admin_media.models import (
    AdminMediaUploadListRead,
    AdminMediaUploadRead,
    AdminMediaUploadReservation,
    AdminMediaUploadReservationRead,
)
from app.admin_media.repository import AdminMediaUploadRepository
from app.community_intake.repository import default_storage
from app.core.config import settings
from app.db.session import session_scope
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/media")

MediaUploader = Annotated[
    RequestIdentity,
    Depends(require_capability("media.upload")),
]


def _repository(session: Session) -> AdminMediaUploadRepository:
    return AdminMediaUploadRepository(
        session,
        default_storage(
            settings.community_intake_storage_signing_key,
            settings.community_intake_storage_reference_ttl_seconds,
            supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key,
        ),
    )


def _database_unavailable(error: SQLAlchemyError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "admin_media_database_unavailable"},
    )


def _require_session(session: Session | None) -> Session:
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "admin_media_database_unavailable"},
        )
    return session


@router.post(
    "/upload-url",
    response_model=AdminMediaUploadReservationRead,
    status_code=status.HTTP_201_CREATED,
)
def reserve_admin_media_upload(
    command: AdminMediaUploadReservation,
    identity: MediaUploader,
) -> AdminMediaUploadReservationRead:
    try:
        with session_scope() as session:
            return _repository(_require_session(session)).reserve(command, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.get("/uploads", response_model=AdminMediaUploadListRead)
def list_admin_media_uploads(
    identity: MediaUploader,
    panda_id: Annotated[UUID, Query()],
) -> AdminMediaUploadListRead:
    _ = identity
    try:
        with session_scope() as session:
            return _repository(_require_session(session)).list_for_panda(panda_id)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/uploads/{upload_id}", response_model=AdminMediaUploadRead)
async def upload_admin_media_content(
    upload_id: UUID,
    request: Request,
    identity: MediaUploader,
    upload_reference: Annotated[str, Header(alias="X-Upload-Reference", min_length=20)],
) -> AdminMediaUploadRead:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(
            status_code=422,
            detail={"code": "MEDIA_UPLOAD_CONTENT_TYPE_UNSUPPORTED"},
        )
    content = await request.body()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail={"code": "MEDIA_UPLOAD_TOO_LARGE"})
    try:
        with session_scope() as session:
            return _repository(_require_session(session)).upload(
                upload_id,
                upload_reference=upload_reference,
                content=content,
                content_type=content_type,
                identity=identity,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error
