from datetime import UTC, datetime
from threading import RLock
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import has_database, session_scope
from app.domain.publication_workflow import (
    ChangeSet,
    EntityRevision,
    WorkflowConflict,
    preview_revisions,
)
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetRead,
    ChangeSetReview,
    EntityRevisionRead,
    PublicationAction,
    PublicationBatchCreate,
    PublicationBatchRead,
    PublicationIssueRead,
    PublicationPreviewRead,
)
from app.services import publication_repository

CHANGE_SETS: dict[UUID, ChangeSet] = {}
PUBLICATION_BATCHES: dict[UUID, PublicationBatchRead] = {}
AUDIT_EVENTS: list[dict[str, object]] = []
ACTIVE_BATCH_ID: UUID | None = None
WORKFLOW_LOCK = RLock()


def _audit(event_type: str, actor_id: UUID, subject_id: UUID, reason: str) -> None:
    AUDIT_EVENTS.append(
        {
            "id": uuid4(),
            "event_type": event_type,
            "actor_id": actor_id,
            "subject_id": subject_id,
            "reason": reason,
            "occurred_at": datetime.now(UTC),
        }
    )


def _change_set_read(change_set: ChangeSet) -> ChangeSetRead:
    return ChangeSetRead(
        id=change_set.id,
        title=change_set.title,
        reason=change_set.reason,
        status=change_set.status,
        created_by=change_set.created_by,
        reviewed_by=change_set.reviewed_by,
        review_reason=change_set.review_reason,
        revisions=[
            EntityRevisionRead(
                id=revision.id,
                entity_type=revision.entity_type,
                entity_id=revision.entity_id,
                payload=revision.payload,
                created_by=revision.created_by,
                substantive_modified_by=revision.substantive_modified_by,
            )
            for revision in change_set.revisions
        ],
    )


def _get_change_set(change_set_id: UUID) -> ChangeSet:
    change_set = CHANGE_SETS.get(change_set_id)
    if change_set is None:
        raise HTTPException(status_code=404, detail="Change set not found")
    return change_set


def _get_batch(batch_id: UUID) -> PublicationBatchRead:
    batch = PUBLICATION_BATCHES.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Publication batch not found")
    return batch


def _conflict(error: WorkflowConflict) -> HTTPException:
    return HTTPException(status_code=409, detail=str(error))


def create_change_set(payload: ChangeSetCreate, actor_id: UUID) -> ChangeSetRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.create_change_set(session, payload, actor_id)
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    revisions = tuple(
        EntityRevision.create(
            entity_type=revision.entity_type,
            entity_id=revision.entity_id,
            payload=revision.payload,
            actor_id=actor_id,
        )
        for revision in payload.revisions
    )
    try:
        change_set = ChangeSet.create(
            title=payload.title,
            reason=payload.reason,
            actor_id=actor_id,
            revisions=revisions,
        )
    except WorkflowConflict as error:
        raise _conflict(error) from error

    with WORKFLOW_LOCK:
        CHANGE_SETS[change_set.id] = change_set
        _audit("change_set.created", actor_id, change_set.id, payload.reason)
    return _change_set_read(change_set)


def submit_change_set(change_set_id: UUID, actor_id: UUID) -> ChangeSetRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.submit_change_set(
                    session, change_set_id, actor_id
                )
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        current = _get_change_set(change_set_id)
        try:
            updated = current.submit(actor_id=actor_id)
        except WorkflowConflict as error:
            raise _conflict(error) from error
        CHANGE_SETS[change_set_id] = updated
        _audit("change_set.submitted", actor_id, change_set_id, current.reason)
    return _change_set_read(updated)


def review_change_set(
    change_set_id: UUID,
    payload: ChangeSetReview,
    actor_id: UUID,
) -> ChangeSetRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.review_change_set(
                    session, change_set_id, payload, actor_id
                )
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        current = _get_change_set(change_set_id)
        try:
            updated = current.review(
                actor_id=actor_id,
                decision=payload.decision,
                reason=payload.reason,
            )
        except WorkflowConflict as error:
            raise _conflict(error) from error
        CHANGE_SETS[change_set_id] = updated
        _audit(f"change_set.{payload.decision}", actor_id, change_set_id, payload.reason)
    return _change_set_read(updated)


def create_publication_batch(
    payload: PublicationBatchCreate,
    actor_id: UUID,
) -> PublicationBatchRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.create_publication_batch(
                    session, payload, actor_id
                )
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        change_sets = [_get_change_set(change_set_id) for change_set_id in payload.change_set_ids]
        if any(change_set.status != "approved" for change_set in change_sets):
            raise HTTPException(
                status_code=409,
                detail="Only independently reviewed change sets can enter a publication batch",
            )
        if any(
            batch.data_version == payload.data_version
            for batch in PUBLICATION_BATCHES.values()
        ):
            raise HTTPException(status_code=409, detail="Data version already exists")

        batch = PublicationBatchRead(
            id=uuid4(),
            change_set_ids=payload.change_set_ids,
            public_schema_version=payload.public_schema_version,
            data_version=payload.data_version,
            reason=payload.reason,
            correlation_id=payload.correlation_id,
            operation="release",
            status="draft",
            created_by=actor_id,
        )
        PUBLICATION_BATCHES[batch.id] = batch
        _audit("publication_batch.created", actor_id, batch.id, payload.reason)
    return batch


def preview_publication_batch(batch_id: UUID) -> PublicationPreviewRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                change_sets = publication_repository.get_batch_change_sets(
                    session, batch_id
                )
                revisions = tuple(
                    revision
                    for change_set in change_sets
                    for revision in change_set.revisions
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
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    batch = _get_batch(batch_id)
    revisions = tuple(
        revision
        for change_set_id in batch.change_set_ids
        for revision in _get_change_set(change_set_id).revisions
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


def publish_batch(batch_id: UUID, actor_id: UUID) -> PublicationBatchRead:
    global ACTIVE_BATCH_ID

    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                change_sets = publication_repository.get_batch_change_sets(
                    session, batch_id
                )
                preview = preview_revisions(
                    tuple(
                        revision
                        for change_set in change_sets
                        for revision in change_set.revisions
                    )
                )
                if not preview.is_publishable:
                    raise HTTPException(
                        status_code=409,
                        detail="Publication preview has blocking issues",
                    )
                result = publication_repository.publish_batch(session, batch_id, actor_id)
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        batch = _get_batch(batch_id)
        if batch.status != "draft":
            raise HTTPException(status_code=409, detail="Publication batch is immutable")
        preview = preview_publication_batch(batch_id)
        if not preview.is_publishable:
            raise HTTPException(status_code=409, detail="Publication preview has blocking issues")
        published = batch.model_copy(
            update={
                "status": "published",
                "published_by": actor_id,
                "published_at": datetime.now(UTC),
                "previous_batch_id": ACTIVE_BATCH_ID,
            }
        )
        PUBLICATION_BATCHES[batch_id] = published
        ACTIVE_BATCH_ID = batch_id
        _audit("publication_batch.published", actor_id, batch_id, batch.reason)
    return published


def _publish_release_action(
    *,
    target: PublicationBatchRead,
    payload: PublicationAction,
    actor_id: UUID,
    operation: str,
) -> PublicationBatchRead:
    global ACTIVE_BATCH_ID

    if target.status != "published":
        raise HTTPException(status_code=409, detail="Release action requires a published target")
    if any(
        batch.data_version == payload.data_version for batch in PUBLICATION_BATCHES.values()
    ):
        raise HTTPException(status_code=409, detail="Data version already exists")

    action_batch = PublicationBatchRead(
        id=uuid4(),
        change_set_ids=target.change_set_ids if operation == "rollback" else [],
        public_schema_version=target.public_schema_version,
        data_version=payload.data_version,
        reason=payload.reason,
        correlation_id=payload.correlation_id,
        operation=operation,
        status="published",
        created_by=actor_id,
        published_by=actor_id,
        published_at=datetime.now(UTC),
        previous_batch_id=ACTIVE_BATCH_ID,
        rollback_target_id=target.id if operation == "rollback" else None,
        withdrawal_target_id=target.id if operation == "withdrawal" else None,
    )
    PUBLICATION_BATCHES[action_batch.id] = action_batch
    ACTIVE_BATCH_ID = action_batch.id
    _audit(f"publication_batch.{operation}", actor_id, action_batch.id, payload.reason)
    return action_batch


def rollback_to_batch(
    target_batch_id: UUID,
    payload: PublicationAction,
    actor_id: UUID,
) -> PublicationBatchRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.publish_release_action(
                    session,
                    target_batch_id=target_batch_id,
                    payload=payload,
                    actor_id=actor_id,
                    operation="rollback",
                )
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        return _publish_release_action(
            target=_get_batch(target_batch_id),
            payload=payload,
            actor_id=actor_id,
            operation="rollback",
        )


def withdraw_batch(
    target_batch_id: UUID,
    payload: PublicationAction,
    actor_id: UUID,
) -> PublicationBatchRead:
    if has_database():
        try:
            with session_scope() as session:
                if session is None:
                    raise SQLAlchemyError("Database session unavailable")
                result = publication_repository.publish_release_action(
                    session,
                    target_batch_id=target_batch_id,
                    payload=payload,
                    actor_id=actor_id,
                    operation="withdrawal",
                )
                session.commit()
                return result
        except HTTPException:
            raise
        except SQLAlchemyError as error:
            raise HTTPException(status_code=503, detail="Database unavailable") from error

    with WORKFLOW_LOCK:
        return _publish_release_action(
            target=_get_batch(target_batch_id),
            payload=payload,
            actor_id=actor_id,
            operation="withdrawal",
        )
