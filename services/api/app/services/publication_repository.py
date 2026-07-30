import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.activity.models import (
    ActivityAction,
    ActivityConflictError,
    ActivitySourceEvent,
    ArchiveActivityDescriptor,
)
from app.activity.validation import validate_public_activity_dependencies
from app.domain.publication_workflow import ChangeSet, EntityRevision, WorkflowConflict
from app.integration.events import AggregateReference, IntegrationEventEnvelope
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
            select
              id, title, reason, status, created_by, reviewed_by, review_reason,
              governance_mode, validation_state, validated_by, validated_at,
              validation_reason, base_archive_version, governance_version
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
              revision.revision_number,
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
            revision_number=revision["revision_number"],
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
        governance_mode=row["governance_mode"],
        validation_state=row["validation_state"],
        validated_by=row["validated_by"],
        validated_at=row["validated_at"],
        validation_reason=row["validation_reason"],
        base_archive_version=row["base_archive_version"],
        governance_version=row["governance_version"],
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
        governance_mode=change_set.governance_mode,
        validation_state=change_set.validation_state,
        validated_by=change_set.validated_by,
        validated_at=change_set.validated_at,
        validation_reason=change_set.validation_reason,
        base_archive_version=change_set.base_archive_version,
        governance_version=change_set.governance_version,
        requires_explicit_revalidation=(
            change_set.governance_mode == "four-eyes-v1"
            and change_set.status in {"submitted", "approved"}
        ),
        legacy_publication_eligible=(
            change_set.governance_mode == "four-eyes-v1" and change_set.status == "approved"
        ),
        revisions=[
            EntityRevisionRead(
                id=revision.id,
                entity_type=revision.entity_type,
                entity_id=revision.entity_id,
                revision_number=revision.revision_number,
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
        database_migration_version=row["database_migration_version"],
        projection_code_version=row["projection_code_version"],
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
              id, public_schema_version, data_version, database_migration_version,
              projection_code_version, reason, correlation_id,
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


def _activity_descriptors_for_batch(
    session: Session,
    batch_id: UUID,
) -> list[ArchiveActivityDescriptor]:
    rows = session.execute(
        text(
            """
            select revision.revision_number, revision.payload
            from public.publication_batch_change_sets batch_link
            join public.change_set_revisions change_link
              on change_link.change_set_id = batch_link.change_set_id
            join public.entity_revisions revision on revision.id = change_link.revision_id
            where batch_link.batch_id = :batch_id
            order by revision.revision_number, revision.created_at, revision.id
            """
        ),
        {"batch_id": batch_id},
    ).mappings().all()
    descriptors_by_source: dict[str, ArchiveActivityDescriptor] = {}
    for row in rows:
        payload = _json_object(row["payload"])
        raw_descriptors = payload.get("activities", [])
        if not isinstance(raw_descriptors, list):
            raise HTTPException(status_code=409, detail="Archive Activity descriptors are invalid")
        for raw_descriptor in raw_descriptors:
            descriptor = ArchiveActivityDescriptor.model_validate(raw_descriptor)
            if descriptor.source_id in descriptors_by_source:
                raise HTTPException(
                    status_code=409,
                    detail="Publication batch contains duplicate Activity source IDs",
                )
            descriptors_by_source[descriptor.source_id] = descriptor
    descriptors = list(descriptors_by_source.values())
    try:
        validate_public_activity_dependencies(session, descriptors)
    except ActivityConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return descriptors


def _next_activity_source_version(session: Session, source_id: str) -> int:
    return int(
        session.execute(
            text(
                """
                select coalesce(max(aggregate_version), 0) + 1
                from integration.outbox_events
                where source_context = 'archive'
                  and aggregate_type = 'activity_source'
                  and aggregate_id = :source_id
                """
            ),
            {"source_id": source_id},
        ).scalar_one()
    )


def _insert_outbox_envelope(session: Session, envelope: IntegrationEventEnvelope) -> None:
    record = envelope.to_outbox_record()
    session.execute(
        text(
            """
            insert into integration.outbox_events (
              event_id, schema_version, event_type, event_version, source_context,
              aggregate_type, aggregate_id, aggregate_version, idempotency_key,
              correlation_id, causation_id, occurred_at, payload
            ) values (
              :event_id, :schema_version, :event_type, :event_version, :source_context,
              :aggregate_type, :aggregate_id, :aggregate_version, :idempotency_key,
              :correlation_id, :causation_id, :occurred_at, cast(:payload as jsonb)
            )
            """
        ),
        {**record, "payload": json.dumps(record["payload"])},
    )


def _emit_archive_activity_events(
    session: Session,
    batch: dict[str, Any],
    descriptors: list[ArchiveActivityDescriptor],
) -> None:
    event_types = {
        ActivityAction.PUBLISH: "archive.activity.published",
        ActivityAction.SNAPSHOT_UPDATE: "archive.activity.snapshot_updated",
        ActivityAction.CORRECTION: "archive.activity.corrected",
        ActivityAction.RETRACTION: "archive.activity.retracted",
    }
    for descriptor in descriptors:
        action = descriptor.action
        source_version = _next_activity_source_version(session, descriptor.source_id)
        event_id = uuid4()
        provenance = descriptor.provenance.model_dump(mode="json")
        provenance.update(
            {
                "release_id": str(batch["id"]),
                "data_version": batch["data_version"],
                "public_schema_version": batch["public_schema_version"],
                "projection_code_version": batch["projection_code_version"],
            }
        )
        event = ActivitySourceEvent.model_validate(
            {
                **descriptor.model_dump(
                    mode="json",
                    exclude={"source_id", "action", "retraction_reason", "provenance"},
                ),
                "event_id": event_id,
                "source_type": "archive.release",
                "source_id": descriptor.source_id,
                "source_version": source_version,
                "action": action,
                "published_at": batch["published_at"],
                "retraction_reason": descriptor.retraction_reason,
                "correlation_id": batch["correlation_id"],
                "causation_id": batch["id"],
                "is_backfill": False,
                "provenance": provenance,
            }
        )
        envelope = IntegrationEventEnvelope(
            event_id=event_id,
            event_type=event_types[action],
            source_context="archive",
            aggregate=AggregateReference(
                type="activity_source",
                id=descriptor.source_id,
                version=source_version,
            ),
            idempotency_key=(
                f"activity:{batch['id']}:{descriptor.source_id}:{source_version}:{action.value}"
            ),
            correlation_id=batch["correlation_id"],
            causation_id=batch["id"],
            occurred_at=batch["published_at"],
            payload=event.model_dump(mode="json"),
        )
        _insert_outbox_envelope(session, envelope)


def create_change_set(
    session: Session,
    payload: ChangeSetCreate,
    actor_id: UUID,
) -> ChangeSetRead:
    base_records: dict[tuple[str, str], dict[str, Any]] = {}
    for revision in payload.revisions:
        base_record: dict[str, Any] = {}
        if revision.entity_type == "panda":
            panda_row = session.execute(
                text(
                    """
                    select
                      slug,
                      name_zh,
                      name_en,
                      gender,
                      birth_date::text as birth_date,
                      death_date::text as death_date,
                      status::text as status,
                      birthplace,
                      current_location,
                      intro,
                      tags,
                      is_featured
                    from public.pandas
                    where id::text = :panda_id
                    """
                ),
                {"panda_id": revision.entity_id},
            ).mappings().first()
            if panda_row is None:
                raise HTTPException(
                    status_code=422,
                    detail="Publication revisions require an existing trusted panda identity",
                )
            base_record.update(dict(panda_row))
        active_public_record = get_active_public_record(
            session,
            revision.entity_type,
            revision.entity_id,
        )
        if active_public_record and not active_public_record.get("_withdrawn"):
            base_record.update(
                {
                    key: value
                    for key, value in active_public_record.items()
                    if not key.startswith("_")
                }
            )
        base_records[(revision.entity_type, revision.entity_id)] = base_record

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
        revision_payload = revision.payload.model_dump(mode="json")
        revision_payload["public_record"] = {
            **base_records[(revision.entity_type, revision.entity_id)],
            **revision_payload["public_record"],
        }
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
                "payload": json.dumps(revision_payload),
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
                  public_schema_version, data_version, database_migration_version,
                  projection_code_version, reason, correlation_id, created_by
                ) values (
                  :public_schema_version, :data_version, :database_migration_version,
                  :projection_code_version, :reason, :correlation_id, :actor_id
                )
                returning id
                """
            ),
            {
                "public_schema_version": payload.public_schema_version,
                "data_version": payload.data_version,
                "database_migration_version": payload.database_migration_version,
                "projection_code_version": payload.projection_code_version,
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
    change_set_ids = set(batch.change_set_ids)
    if batch.status == "draft":
        active_row = session.execute(
            text(
                """
                select batch.id, batch.operation
                from public.public_release_pointer pointer
                join public.publication_batches batch on batch.id = pointer.active_batch_id
                where pointer.singleton = true
                """
            )
        ).mappings().first()
        if active_row is not None and active_row["operation"] != "withdrawal":
            change_set_ids.update(
                session.execute(
                    text(
                        """
                        select change_set_id
                        from public.publication_batch_change_sets
                        where batch_id = :batch_id
                        """
                    ),
                    {"batch_id": active_row["id"]},
                ).scalars()
            )
    return [_change_set_from_db(session, item) for item in sorted(change_set_ids, key=str)]


def hydrate_revisions_for_preview(
    session: Session,
    revisions: tuple[EntityRevision, ...],
) -> tuple[EntityRevision, ...]:
    revision_keys = {(item.entity_type, item.entity_id) for item in revisions}
    reference_queries = {
        "panda": "select exists(select 1 from public.pandas where id::text = :id or slug = :id)",
        "evidence_source": """
            select exists(
              select 1 from public.evidence_sources
              where id = :id and publication_status = 'published'
            )
        """,
        "institution": """
            select exists(
              select 1 from public.institutions
              where id::text = :id and publication_status = 'published'
            )
        """,
        "facility": """
            select exists(
              select 1 from public.facilities
              where id::text = :id and publication_status = 'published'
            )
        """,
        "domain_event": """
            select exists(
              select 1 from public.domain_events
              where id = :id and publication_status = 'published'
            )
        """,
        "residency": """
            select exists(
              select 1 from public.panda_residencies
              where id = :id and publication_status = 'published'
            )
        """,
    }
    hydrated: list[EntityRevision] = []

    for revision in revisions:
        payload = json.loads(json.dumps(revision.payload))
        checks = payload.get("publication_checks")
        if not isinstance(checks, dict):
            hydrated.append(revision)
            continue

        for reference in checks.get("references", []):
            if not isinstance(reference, dict):
                continue
            key = (str(reference.get("target_type")), str(reference.get("target_id")))
            resolved = key in revision_keys
            query = reference_queries.get(key[0])
            if not resolved and query is not None:
                resolved = bool(session.execute(text(query), {"id": key[1]}).scalar_one())
            reference["resolved"] = resolved

        for source in checks.get("sources", []):
            if not isinstance(source, dict):
                continue
            state = session.execute(
                text(
                    """
                    select access_state
                    from public.evidence_sources
                    where id = :id and publication_status = 'published'
                    """
                ),
                {"id": source.get("id")},
            ).scalar_one_or_none()
            source["access_state"] = state or "missing"

        for media in checks.get("media", []):
            if not isinstance(media, dict):
                continue
            license_value = session.execute(
                text("select license from public.media_assets where id::text = :id"),
                {"id": media.get("id")},
            ).scalar_one_or_none()
            media["license"] = license_value

        hydrated.append(
            EntityRevision(
                id=revision.id,
                entity_type=revision.entity_type,
                entity_id=revision.entity_id,
                revision_number=revision.revision_number,
                payload=payload,
                created_by=revision.created_by,
                substantive_modified_by=revision.substantive_modified_by,
            )
        )

    return tuple(hydrated)


def lock_batch_for_publication(session: Session, batch_id: UUID) -> None:
    row = session.execute(
        text(
            """
            select status
            from public.publication_batches
            where id = :batch_id
            for update
            """
        ),
        {"batch_id": batch_id},
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Publication batch not found")


def lock_release_pointer(session: Session) -> None:
    session.execute(
        text(
            """
            select active_batch_id
            from public.public_release_pointer
            where singleton = true
            for update
            """
        )
    ).one()


def publish_batch(
    session: Session,
    batch_id: UUID,
    actor_id: UUID,
) -> PublicationBatchRead:
    activity_descriptors = _activity_descriptors_for_batch(session, batch_id)
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
    _emit_archive_activity_events(session, dict(row), activity_descriptors)
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
                  public_schema_version, data_version, database_migration_version,
                  projection_code_version, reason, correlation_id,
                  operation, status, created_by, published_by, published_at,
                  previous_batch_id, rollback_target_id, withdrawal_target_id
                ) values (
                  :public_schema_version, :data_version, :database_migration_version,
                  :projection_code_version, :reason, :correlation_id,
                  :operation, 'draft', :actor_id, null, null,
                  :previous_batch_id, :rollback_target_id, :withdrawal_target_id
                )
                returning
                  id, public_schema_version, data_version, database_migration_version,
                  projection_code_version, reason, correlation_id,
                  operation, status, created_by, published_by, published_at,
                  previous_batch_id, rollback_target_id, withdrawal_target_id
                """
            ),
            {
                "public_schema_version": target.public_schema_version,
                "data_version": payload.data_version,
                "database_migration_version": target.database_migration_version,
                "projection_code_version": target.projection_code_version,
                "reason": payload.reason,
                "correlation_id": payload.correlation_id,
                "operation": operation,
                "actor_id": actor_id,
                "previous_batch_id": current_batch_id,
                "rollback_target_id": target.id if operation == "rollback" else None,
                "withdrawal_target_id": target.id if operation == "withdrawal" else None,
            },
        ).mappings().one()
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="Data version already exists") from error
    if operation == "rollback":
        session.execute(
            text(
                """
                insert into public.publication_batch_change_sets (batch_id, change_set_id)
                select :batch_id, change_set_id
                from public.publication_batch_change_sets
                where batch_id = :target_batch_id
                """
            ),
            {"batch_id": row["id"], "target_batch_id": target.id},
        )

    published_at = datetime.now(UTC)
    row = session.execute(
        text(
            """
            update public.publication_batches
            set status = 'published', published_by = :actor_id, published_at = :published_at
            where id = :batch_id
            returning
              id, public_schema_version, data_version, database_migration_version,
              projection_code_version, reason, correlation_id,
              operation, status, created_by, published_by, published_at,
              previous_batch_id, rollback_target_id, withdrawal_target_id
            """
        ),
        {"batch_id": row["id"], "actor_id": actor_id, "published_at": published_at},
    ).mappings().one()
    session.execute(
        text(
            """
            update public.public_release_pointer
            set active_batch_id = :batch_id, switched_at = :published_at
            where singleton = true
            """
        ),
        {"batch_id": row["id"], "published_at": published_at},
    )
    _insert_audit(
        session,
        event_type=f"publication_batch.{operation}",
        subject_type="publication_batch",
        subject_id=row["id"],
        actor_id=actor_id,
        reason=payload.reason,
        correlation_id=payload.correlation_id,
        metadata={
            "target_batch_id": str(target.id),
            "public_schema_version": row["public_schema_version"],
            "data_version": row["data_version"],
            "database_migration_version": row["database_migration_version"],
            "projection_code_version": row["projection_code_version"],
        },
    )
    change_set_ids = target.change_set_ids if operation == "rollback" else []
    return _batch_from_row(dict(row), change_set_ids)


def get_active_public_record(
    session: Session,
    entity_type: str,
    entity_id: str,
) -> dict[str, Any] | None:
    row = session.execute(
        text(
            """
            with active as (
              select
                batch.id,
                batch.operation,
                batch.public_schema_version,
                batch.data_version,
                case
                  when batch.operation = 'withdrawal' then batch.withdrawal_target_id
                  else batch.id
                end as source_batch_id
              from public.public_release_pointer pointer
              join public.publication_batches batch on batch.id = pointer.active_batch_id
              where pointer.singleton = true
            )
            select
              revision.payload,
              active.operation,
              active.public_schema_version,
              active.data_version
            from active
            join public.publication_batch_change_sets batch_link
              on batch_link.batch_id = active.source_batch_id
            join public.change_set_revisions change_link
              on change_link.change_set_id = batch_link.change_set_id
            join public.entity_revisions revision on revision.id = change_link.revision_id
            where revision.entity_type = :entity_type
              and revision.entity_id = :entity_id
            order by revision.revision_number desc, revision.created_at desc
            limit 1
            """
        ),
        {"entity_type": entity_type, "entity_id": entity_id},
    ).mappings().first()
    if row is None:
        return None
    if row["operation"] == "withdrawal":
        return {"_withdrawn": True}
    payload = _json_object(row["payload"])
    public_record = payload.get("public_record")
    if not isinstance(public_record, dict):
        return None
    return {
        **public_record,
        "_publication": {
            "public_schema_version": row["public_schema_version"],
            "data_version": row["data_version"],
        },
    }
