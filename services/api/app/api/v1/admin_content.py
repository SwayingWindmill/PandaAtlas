from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.admin_content.centers import AdminContentCenterService
from app.admin_content.repository import AdminContentRepository
from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableValidationCommand,
)
from app.archive_publication.service import publish_change_set, validate_change_set
from app.db.session import session_scope
from app.identity.models import RequestIdentity
from app.identity.security import require_capability
from app.schemas.admin_content import (
    AdminCenterDomain,
    AdminCenterRead,
    AdminContentCommand,
    AdminContentDashboardRead,
    AdminEvidenceSourceCreate,
    AdminPandaBasicChange,
    AdminPandaChangeSetRead,
    AdminPandaCreate,
    AdminPandaDetailRead,
    AdminPandaDraftCreatedRead,
    AdminPandaEventCreate,
    AdminPandaListRead,
    AdminPandaMediaCreate,
    AdminPandaNameCreate,
    AdminPandaParentCreate,
    AdminPandaPublishRead,
    AdminPandaResidencyCreate,
    AdminPandaValidationRead,
    AdminValidationIssueRead,
)

router = APIRouter(prefix="/admin/content")

ContentReader = Annotated[
    RequestIdentity,
    Depends(require_capability("admin.shell.access")),
]
ContentEditor = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.change_set.create", legacy_mode="workflow")),
]
ContentValidator = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.accountable.validate", legacy_mode="workflow")),
]
ContentPublisher = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.publish",
            recent_auth=True,
            legacy_mode="workflow",
        )
    ),
]


def _database_unavailable(error: SQLAlchemyError) -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={"code": "admin_content_database_unavailable"},
    )


def _require_session(session: object | None) -> None:
    if session is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "admin_content_database_unavailable"},
        )


def _change_set_metadata(change_set_id: UUID) -> tuple[int, str]:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).change_set_state(change_set_id)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


def _current_archive_version() -> str:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).current_archive_version()
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


def _assert_change_set_panda(change_set_id: UUID, panda_id: UUID) -> None:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            found = session.execute(
                text(
                    """
                    select exists(
                      select 1
                      from public.change_set_revisions link
                      join public.entity_revisions revision on revision.id = link.revision_id
                      where link.change_set_id = :change_set_id
                        and revision.entity_type = 'panda'
                        and revision.entity_id = :panda_id
                    )
                    """
                ),
                {"change_set_id": change_set_id, "panda_id": str(panda_id)},
            ).scalar_one()
            if not found:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "admin_panda_change_set_not_found"},
                )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.get("/dashboard", response_model=AdminContentDashboardRead)
def admin_content_dashboard(identity: ContentReader) -> AdminContentDashboardRead:
    _ = identity
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).dashboard()
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.get("/centers/{domain}", response_model=AdminCenterRead)
def list_admin_content_center(
    domain: AdminCenterDomain,
    identity: ContentReader,
    q: str | None = Query(default=None, max_length=200),
    issue_only: bool = False,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> AdminCenterRead:
    _ = identity
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentCenterService(session).list_center(
                domain,
                query=q,
                issue_only=issue_only,
                page=page,
                page_size=page_size,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.get("/pandas", response_model=AdminPandaListRead)
def list_admin_pandas(
    identity: ContentReader,
    q: str | None = Query(default=None, max_length=200),
    publication_state: Literal["draft", "published"] | None = None,
    quality: Literal["verified", "likely", "uncertain"] | None = None,
    issue: Literal["incomplete", "no-cover", "no-source", "no-location"] | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
) -> AdminPandaListRead:
    _ = identity
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).list_pandas(
                query=q,
                publication_state=publication_state,
                quality=quality,
                issue=issue,
                page=page,
                page_size=page_size,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post(
    "/pandas",
    response_model=AdminPandaDraftCreatedRead,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_panda_draft(
    payload: AdminPandaCreate,
    identity: ContentEditor,
) -> AdminPandaDraftCreatedRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).create_panda_draft(payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.get("/pandas/{panda_id}", response_model=AdminPandaDetailRead)
def get_admin_panda(
    panda_id: UUID,
    identity: ContentReader,
) -> AdminPandaDetailRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).get_panda(panda_id, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post(
    "/pandas/{panda_id}/change-sets",
    response_model=AdminPandaChangeSetRead,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_panda_change_set(
    panda_id: UUID,
    payload: AdminPandaBasicChange,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).create_basic_change_set(
                panda_id,
                payload,
                identity,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/names", response_model=AdminPandaChangeSetRead)
def add_admin_panda_name(
    panda_id: UUID,
    payload: AdminPandaNameCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_name(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/parents", response_model=AdminPandaChangeSetRead)
def add_admin_panda_parent(
    panda_id: UUID,
    payload: AdminPandaParentCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_parent(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/residencies", response_model=AdminPandaChangeSetRead)
def add_admin_panda_residency(
    panda_id: UUID,
    payload: AdminPandaResidencyCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_residency(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/events", response_model=AdminPandaChangeSetRead)
def add_admin_panda_event(
    panda_id: UUID,
    payload: AdminPandaEventCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_event(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/sources", response_model=AdminPandaChangeSetRead)
def add_admin_panda_source(
    panda_id: UUID,
    payload: AdminEvidenceSourceCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_source(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post("/pandas/{panda_id}/media", response_model=AdminPandaChangeSetRead)
def add_admin_panda_media(
    panda_id: UUID,
    payload: AdminPandaMediaCreate,
    identity: ContentEditor,
) -> AdminPandaChangeSetRead:
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).add_media(panda_id, payload, identity)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post(
    "/pandas/{panda_id}/change-sets/{change_set_id}/validate",
    response_model=AdminPandaValidationRead,
)
def validate_admin_panda_change_set(
    panda_id: UUID,
    change_set_id: UUID,
    command: AdminContentCommand,
    identity: ContentValidator,
) -> AdminPandaValidationRead:
    _assert_change_set_panda(change_set_id, panda_id)
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            repository = AdminContentRepository(session)
            expected_version, state = repository.change_set_state(change_set_id)
            if state != "draft":
                raise HTTPException(
                    status_code=409,
                    detail={"code": "admin_change_set_not_editable", "state": state},
                )
            repository.refresh_runtime_panda_revisions(change_set_id, identity)
            expected_version, _state = repository.change_set_state(change_set_id)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error
    result = validate_change_set(
        change_set_id,
        AccountableValidationCommand(
            expected_version=expected_version,
            idempotency_key=f"admin-panda-validate-{uuid4()}",
            base_archive_version=_current_archive_version(),
            reason=command.reason,
            risk_level="ordinary",
            correlation_id=uuid4(),
        ),
        identity,
    )
    return AdminPandaValidationRead(
        change_set_id=result.change_set_id,
        outcome=result.outcome.value,
        governance_version=result.governance_version,
        base_archive_version=result.base_archive_version,
        issues=[
            AdminValidationIssueRead.model_validate(item.model_dump())
            for item in result.issues
        ],
    )


@router.post(
    "/pandas/{panda_id}/change-sets/{change_set_id}/reopen",
    response_model=AdminPandaChangeSetRead,
)
def reopen_admin_panda_change_set(
    panda_id: UUID,
    change_set_id: UUID,
    command: AdminContentCommand,
    identity: ContentValidator,
) -> AdminPandaChangeSetRead:
    _assert_change_set_panda(change_set_id, panda_id)
    try:
        with session_scope() as session:
            _require_session(session)
            assert session is not None
            return AdminContentRepository(session).reopen_failed_change_set(
                change_set_id,
                identity=identity,
                reason=command.reason,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise _database_unavailable(error) from error


@router.post(
    "/pandas/{panda_id}/change-sets/{change_set_id}/publish",
    response_model=AdminPandaPublishRead,
)
def publish_admin_panda_change_set(
    panda_id: UUID,
    change_set_id: UUID,
    command: AdminContentCommand,
    identity: ContentPublisher,
) -> AdminPandaPublishRead:
    _assert_change_set_panda(change_set_id, panda_id)
    expected_version, state = _change_set_metadata(change_set_id)
    if state != "ready":
        raise HTTPException(
            status_code=409,
            detail={"code": "admin_panda_change_set_not_ready", "state": state},
        )
    result = publish_change_set(
        change_set_id,
        AccountablePublishCommand(
            expected_version=expected_version,
            idempotency_key=f"admin-panda-publish-{uuid4()}",
            reason=command.reason,
            data_version=AdminContentRepository.planned_data_version(change_set_id),
            public_schema_version="1.3.0",
            database_migration_version="0041",
            projection_code_version="public-experience-v1",
            correlation_id=uuid4(),
        ),
        identity,
    )
    return AdminPandaPublishRead(
        change_set_id=result.change_set_id,
        release_id=result.release_id,
        data_version=result.data_version,
        published_at=result.published_at,
        public_projection_status=result.public_projection_status,
    )
