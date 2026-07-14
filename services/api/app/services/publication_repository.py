import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.domain.publication_workflow import ChangeSet, EntityRevision, WorkflowConflict
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetRead,
    ChangeSetReview,
    EntityRevisionRead,
    PublicationAction,
    PublicationBatchCreate,
    PublicationBatchRead,
)


def _json_object(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, dict):
            return loaded
    raise ValueError("Revision payload must be a JSON object")


def _change_set_from_db(session: Session, change_set_id: UUID) -> ChangeSet:
    row = session.execute(
        text(
            """
            select id, title, reason, status, created_by, reviewed_by, review_reason
            from public.change_sets
            where id = :change_set_id
            """
        ),
        {"change_set_id": change_set_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Change set not found")

    revision_rows = session.execute(
        text(
            """
            select
              revision.id,
              revision.entity_type,
              revision.entity_id,
              revision.payload,
              revision.created_by,
              revision.substantive_modified_by
            from public.change_set_revisions link
            join public.entity_revisions revision on revision.id = link.revision_id
            where link.change_set_id = :change_set_id
            order by revision.created_at, revision.id
            """
        ),
        {"change_set_id": change_set_id},
    ).mappings().all()
    revisions = tuple(
        EntityRevision(
            id=revision["id"],
            entity_type=revision["entity_type"],
            entity_id=revision["entity_id"],
            payload=_json_object(revision["payload"]),
            created_by=revision["created_by"],
            substantive_modified_by=revision["substantive_modified_by"],
        )
        for revision in revision_rows
    )
    return ChangeSet(
        id=row["id"],
        title=row["title"],
        reason=row["reason"],
        status=row["status"],
        created_by=row["created_by"],
        reviewed_by=row["reviewed_by"],
        review_reason=row["review_reason"],
        revisions=revisions,
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


def _batch_from_row(row: object, change_set_ids: list[UUID]) -> PublicationBatchRead:
    if not isinstance(row, dict):
        row = dict(row)  # type: ignore[arg-type]
    return PublicationBatchRead(
        id=row["id"],
        change_set_ids=change_set_ids,
        public_schema_version=row["public_schema_version"],
        data_version=row["data_version"],
        reason=row["reason"],
        correlation_id=row["correlation_id"],
        operation=row["operation"],
        status=row["status"],
        created_by=row["created_by"],
        published_by=row["published_by"],
        published_at=row["published_at"],
        previous_batch_id=row["previous_batch_id"],
        rollback_target_id=row["rollback_target_id"],
        withdrawal_target_id=row["withdrawal_target_id"],
    )


def _batch_from_db(session: Session, batch_id: UUID) -> PublicationBatchRead:
    row = session.execute(
        text(
            """
            select
              id, public_schema_version, data_version, reason, correlation_id,
              operation, status, created_by, published_by, published_at,
              previous_batch_id, rollback_target_id, withdrawal_target_id
            from public.publication_batches
            where id = :batch_id
            """
        ),
        {"batch_id": batch_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Publication batch not found")
    change_set_ids = list(
        session.execute(
            text(
                """
                select change_set_id
                from public.publication_batch_change_sets
                where batch_id = :batch_id
                order by change_set_id
                """
            ),
            {"batch_id": batch_id},
        ).scalars()
    )
    if row["operation"] == "rollback" and not change_set_ids:
        target_id = row["rollback_target_id"]
        if target_id is not None:
            change_set_ids = _batch_from_db(session, target_id).change_set_ids
    return _batch_from_row(dict(row), change_set_ids)


def _insert_audit(
    session: Session,
    *,
    event_type: str,
    subject_type: str,
    subject_id: UUID,
    actor_id: UUID,
    reason: str,
    correlation_id: UUID | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    session.execute(
        text(
            """
            insert into public.audit_events (
              event_type, subject_type, subject_id, actor_id, reason,
              correlation_id, metadata
            ) values (
              :event_type, :subject_type, :subject_id, :actor_id, :reason,
              :correlation_id, cast(:metadata as jsonb)
            )
            """
        ),
        {
            "event_type": event_type,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "actor_id": actor_id,
            "reason": reason,
            "correlation_id": correlation_id,
            "metadata": json.dumps(metadata or {}),
        },
    )


def create_change_set(
    session: Session,
    payload: ChangeSetCreate,
    actor_id: UUID,
) -> ChangeSetRead:
    change_set_id = session.execute(
        text(
            """
            insert into public.change_sets (title, reason, created_by)
            values (:title, :reason, :actor_id)
            returning id
            """
        ),
        {"title": payload.title, "reason": payload.reason, "actor_id": actor_id},
    ).scalar_one()

    for revision in payload.revisions:
        revision_id = session.execute(
            text(
                """
                insert into public.entity_revisions (
                  entity_type, entity_id, revision_number, payload,
                  created_by, substantive_modified_by
                ) values (
                  :entity_type,
                  :entity_id,
                  (
                    select coalesce(max(revision_number), 0) + 1
                    from public.entity_revisions
                    where entity_type = :entity_type and entity_id = :entity_id
                  ),
                  cast(:payload as jsonb),
                  :actor_id,
                  :actor_id
                )
                returning id
                """
            ),
            {
                "entity_type": revision.entity_type,
                "entity_id": revision.entity_id,
                "payload": json.dumps(revision.payload),
                "actor_id": actor_id,
            },
        ).scalar_one()
        session.execute(
            text(
                """
                insert into public.change_set_revisions (change_set_id, revision_id)
                values (:change_set_id, :revision_id)
                """
            ),
            {"change_set_id": change_set_id, "revision_id": revision_id},
        )

    _insert_audit(
        session,
        event_type="change_set.created",
        subject_type="change_set",
        subject_id=change_set_id,
        actor_id=actor_id,
        reason=payload.reason,
    )
    return _change_set_read(_change_set_from_db(session, change_set_id))


def submit_change_set(
    session: Session,
    change_set_id: UUID,
    actor_id: UUID,
) -> ChangeSetRead:
    current = _change_set_from_db(session, change_set_id)
    try:
        current.submit(actor_id=actor_id)
    except WorkflowConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    session.execute(
        text(
            """
            update public.change_sets
            set status = 'submitted', submitted_at = now()
            where id = :change_set_id
            """
        ),
        {"change_set_id": change_set_id},
    )
    _insert_audit(
        session,
        event_type="change_set.submitted",
        subject_type="change_set",
        subject_id=change_set_id,
        actor_id=actor_id,
        reason=current.reason,
    )
    return _change_set_read(_change_set_from_db(session, change_set_id))


def review_change_set(
    session: Session,
    change_set_id: UUID,
    payload: ChangeSetReview,
    actor_id: UUID,
) -> ChangeSetRead:
    current = _change_set_from_db(session, change_set_id)
    try:
        current.review(
            actor_id=actor_id,
            decision=payload.decision,
            reason=payload.reason,
        )
        session.execute(
            text(
                """
                insert into public.change_set_reviews (
                  change_set_id, decision, reviewer_id, reason
                ) values (:change_set_id, :decision, :actor_id, :reason)
                """
            ),
            {
                "change_set_id": change_set_id,
                "decision": payload.decision,
                "actor_id": actor_id,
                "reason": payload.reason,
            },
        )
    except WorkflowConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DBAPIError as error:
        raise HTTPException(status_code=409, detail="Review transition was rejected") from error

    _insert_audit(
        session,
        event_type=f"change_set.{payload.decision}",
        subject_type="change_set",
        subject_id=change_set_id,
        actor_id=actor_id,
        reason=payload.reason,
    )
    return _change_set_read(_change_set_from_db(session, change_set_id))


def create_publication_batch(
    session: Session,
    payload: PublicationBatchCreate,
    actor_id: UUID,
) -> PublicationBatchRead:
    change_sets = [_change_set_from_db(session, item) for item in payload.change_set_ids]
    if any(change_set.status != "approved" for change_set in change_sets):
        raise HTTPException(
            status_code=409,
            detail="Only independently reviewed change sets can enter a publication batch",
        )
    try:
        batch_id = session.execute(
            text(
                """
                insert into public.publication_batches (
                  public_schema_version, data_version, reason, correlation_id, created_by
                ) values (
                  :public_schema_version, :data_version, :reason, :correlation_id, :actor_id
                )
                returning id
                """
            ),
            {
                "public_schema_version": payload.public_schema_version,
                "data_version": payload.data_version,
                "reason": payload.reason,
                "correlation_id": payload.correlation_id,
                "actor_id": actor_id,
            },
        ).scalar_one()
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="Data version already exists") from error
    for change_set_id in payload.change_set_ids:
        session.execute(
            text(
                """
                insert into public.publication_batch_change_sets (batch_id, change_set_id)
                values (:batch_id, :change_set_id)
                """
            ),
            {"batch_id": batch_id, "change_set_id": change_set_id},
        )
    _insert_audit(
        session,
        event_type="publication_batch.created",
        subject_type="publication_batch",
        subject_id=batch_id,
        actor_id=actor_id,
        reason=payload.reason,
        correlation_id=payload.correlation_id,
    )
    return _batch_from_db(session, batch_id)


def get_batch(session: Session, batch_id: UUID) -> PublicationBatchRead:
    return _batch_from_db(session, batch_id)


def get_batch_change_sets(session: Session, batch_id: UUID) -> list[ChangeSet]:
    batch = _batch_from_db(session, batch_id)
    return [_change_set_from_db(session, item) for item in batch.change_set_ids]


def publish_batch(
    session: Session,
    batch_id: UUID,
    actor_id: UUID,
) -> PublicationBatchRead:
    try:
        row = session.execute(
            text("select * from public.publish_publication_batch(:batch_id, :actor_id)"),
            {"batch_id": batch_id, "actor_id": actor_id},
        ).mappings().one()
    except DBAPIError as error:
        raise HTTPException(
            status_code=409,
            detail="Publication batch could not be published",
        ) from error
    change_set_ids = list(
        session.execute(
            text(
                """
                select change_set_id
                from public.publication_batch_change_sets
                where batch_id = :batch_id
                """
            ),
            {"batch_id": batch_id},
        ).scalars()
    )
    return _batch_from_row(dict(row), change_set_ids)


def publish_release_action(
    session: Session,
    *,
    target_batch_id: UUID,
    payload: PublicationAction,
    actor_id: UUID,
    operation: str,
) -> PublicationBatchRead:
    target = _batch_from_db(session, target_batch_id)
    if target.status != "published":
        raise HTTPException(status_code=409, detail="Release action requires a published target")
    current_batch_id = session.execute(
        text(
            """
            select active_batch_id
            from public.public_release_pointer
            where singleton = true
            for update
            """
        )
    ).scalar_one_or_none()
    try:
        row = session.execute(
            text(
                """
                insert into public.publication_batches (
                  public_schema_version, data_version, reason, correlation_id,
                  operation, status, created_by, published_by, published_at,
                  previous_batch_id, rollback_target_id, withdrawal_target_id
                ) values (
                  :public_schema_version, :data_version, :reason, :correlation_id,
                  :operation, 'published', :actor_id, :actor_id, :published_at,
                  :previous_batch_id, :rollback_target_id, :withdrawal_target_id
                )
                returning
                  id, public_schema_version, data_version, reason, correlation_id,
                  operation, status, created_by, published_by, published_at,
                  previous_batch_id, rollback_target_id, withdrawal_target_id
                """
            ),
            {
                "public_schema_version": target.public_schema_version,
                "data_version": payload.data_version,
                "reason": payload.reason,
                "correlation_id": payload.correlation_id,
                "operation": operation,
                "actor_id": actor_id,
                "published_at": datetime.now(UTC),
                "previous_batch_id": current_batch_id,
                "rollback_target_id": target.id if operation == "rollback" else None,
                "withdrawal_target_id": target.id if operation == "withdrawal" else None,
            },
        ).mappings().one()
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="Data version already exists") from error
    session.execute(
        text(
            """
            update public.public_release_pointer
            set active_batch_id = :batch_id, switched_at = :published_at
            where singleton = true
            """
        ),
        {"batch_id": row["id"], "published_at": row["published_at"]},
    )
    _insert_audit(
        session,
        event_type=f"publication_batch.{operation}",
        subject_type="publication_batch",
        subject_id=row["id"],
        actor_id=actor_id,
        reason=payload.reason,
        correlation_id=payload.correlation_id,
        metadata={"target_batch_id": str(target.id)},
    )
    change_set_ids = target.change_set_ids if operation == "rollback" else []
    return _batch_from_row(dict(row), change_set_ids)
