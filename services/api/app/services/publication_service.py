from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.domain.publication_workflow import ChangeSet, EntityRevision, preview_revisions
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetRead,
    ChangeSetReview,
    PublicationAction,
    PublicationBatchCreate,
    PublicationBatchRead,
    PublicationIssueRead,
    PublicationPreviewRead,
)
from app.services import publication_repository


@contextmanager
def _workflow_session() -> Iterator[Session]:
    if not has_database():
        raise HTTPException(status_code=503, detail="Authoritative database unavailable")
    try:
        with session_scope() as session:
            if session is None:
                raise SQLAlchemyError("Database session unavailable")
            yield session
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error


def _latest_revisions(change_sets: list[ChangeSet]) -> tuple[EntityRevision, ...]:
    latest: dict[tuple[str, str], EntityRevision] = {}
    for change_set in change_sets:
        for revision in change_set.revisions:
            key = (revision.entity_type, revision.entity_id)
            current = latest.get(key)
            if current is None or revision.revision_number > current.revision_number:
                latest[key] = revision
    return tuple(latest.values())


def _preview(session: Session, batch_id: UUID) -> PublicationPreviewRead:
    change_sets = publication_repository.get_batch_change_sets(session, batch_id)
    revisions = publication_repository.hydrate_revisions_for_preview(
        session,
        _latest_revisions(change_sets),
    )
    preview = preview_revisions(revisions)
    return PublicationPreviewRead(
        is_publishable=preview.is_publishable,
        issues=[
            PublicationIssueRead(
                category=issue.category,
                entity_type=issue.entity_type,
                entity_id=issue.entity_id,
                detail=issue.detail,
            )
            for issue in preview.issues
        ],
    )


def create_change_set(payload: ChangeSetCreate, actor_id: UUID) -> ChangeSetRead:
    with _workflow_session() as session:
        result = publication_repository.create_change_set(session, payload, actor_id)
        session.commit()
        return result


def submit_change_set(change_set_id: UUID, actor_id: UUID) -> ChangeSetRead:
    with _workflow_session() as session:
        result = publication_repository.submit_change_set(session, change_set_id, actor_id)
        session.commit()
        return result


def review_change_set(
    change_set_id: UUID,
    payload: ChangeSetReview,
    actor_id: UUID,
) -> ChangeSetRead:
    with _workflow_session() as session:
        result = publication_repository.review_change_set(
            session,
            change_set_id,
            payload,
            actor_id,
        )
        session.commit()
        return result


def create_publication_batch(
    payload: PublicationBatchCreate,
    actor_id: UUID,
) -> PublicationBatchRead:
    with _workflow_session() as session:
        result = publication_repository.create_publication_batch(session, payload, actor_id)
        session.commit()
        return result


def preview_publication_batch(batch_id: UUID) -> PublicationPreviewRead:
    with _workflow_session() as session:
        return _preview(session, batch_id)


def publish_batch(batch_id: UUID, actor_id: UUID) -> PublicationBatchRead:
    with _workflow_session() as session:
        publication_repository.lock_batch_for_publication(session, batch_id)
        publication_repository.lock_release_pointer(session)
        preview = _preview(session, batch_id)
        if not preview.is_publishable:
            raise HTTPException(status_code=409, detail="Publication preview has blocking issues")
        result = publication_repository.publish_batch(session, batch_id, actor_id)
        session.commit()
        return result


def rollback_to_batch(
    target_batch_id: UUID,
    payload: PublicationAction,
    actor_id: UUID,
) -> PublicationBatchRead:
    with _workflow_session() as session:
        result = publication_repository.publish_release_action(
            session,
            target_batch_id=target_batch_id,
            payload=payload,
            actor_id=actor_id,
            operation="rollback",
        )
        session.commit()
        return result


def withdraw_batch(
    target_batch_id: UUID,
    payload: PublicationAction,
    actor_id: UUID,
) -> PublicationBatchRead:
    with _workflow_session() as session:
        result = publication_repository.publish_release_action(
            session,
            target_batch_id=target_batch_id,
            payload=payload,
            actor_id=actor_id,
            operation="withdrawal",
        )
        session.commit()
        return result


def get_active_public_record(entity_type: str, entity_id: str) -> dict[str, Any] | None:
    if not has_database():
        return None
    try:
        with session_scope() as session:
            if session is None:
                raise SQLAlchemyError("Database session unavailable")
            return publication_repository.get_active_public_record(
                session,
                entity_type,
                entity_id,
            )
    except SQLAlchemyError as error:
        if not settings.db_use_mock_fallback:
            raise HTTPException(status_code=503, detail="Database unavailable") from error
        return None
