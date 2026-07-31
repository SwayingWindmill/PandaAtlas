from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from hashlib import sha256
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.archive_publication.models import ArchiveRiskLevel
from app.archive_workbench.models import (
    ArchiveCutoverCommand,
    ArchiveCutoverControlRead,
    ArchiveRehearsalSnapshotRead,
    ArchiveRevisionEvidenceRead,
    ArchiveWorkbenchDetailRead,
    ArchiveWorkbenchItemRead,
    ArchiveWorkbenchListRead,
    ArchiveWorkbenchMetricsRead,
    ArchiveWorkbenchQueue,
    cutover_payload_sha256,
)
from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import RequestIdentity


@contextmanager
def _workbench_session() -> Iterator[Session]:
    if not settings.archive_single_accountable_approver_enabled:
        raise HTTPException(status_code=404, detail={"code": "archive_workbench_disabled"})
    if not has_database():
        raise HTTPException(
            status_code=503,
            detail={"code": "authoritative_database_unavailable"},
        )
    try:
        with session_scope() as session:
            if session is None:
                raise HTTPException(
                    status_code=503,
                    detail={"code": "authoritative_database_unavailable"},
                )
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "authoritative_database_unavailable"},
        ) from error


def _json_object(value: object) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, dict):
            return loaded
    return {}


def _json_array(value: object) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, list):
            return [item for item in loaded if isinstance(item, dict)]
    return []


def _string_array(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, list):
            return [str(item) for item in loaded]
    return []


def _item(row: Any) -> ArchiveWorkbenchItemRead:
    return ArchiveWorkbenchItemRead(
        item_type=str(row["item_type"]),
        item_id=row["item_id"],
        queue=str(row["queue"]),
        title=str(row["title"]),
        status=str(row["status"]),
        risk_level=ArchiveRiskLevel(str(row["risk_level"])),
        version=int(row["version"]),
        base_archive_version=(
            str(row["base_archive_version"])
            if row["base_archive_version"] is not None
            else None
        ),
        release_id=row["release_id"],
        operation_id=row["operation_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def list_workbench_items(
    queue: ArchiveWorkbenchQueue,
    *,
    limit: int = 100,
) -> ArchiveWorkbenchListRead:
    with _workbench_session() as session:
        rows = session.execute(
            text(
                """
                select *
                from public.archive_workbench_queue
                where (:queue = 'all' or queue = :queue)
                order by updated_at asc, item_id
                limit :limit
                """
            ),
            {"queue": queue.value, "limit": limit},
        ).mappings().all()
        items = [_item(row) for row in rows]
        return ArchiveWorkbenchListRead(items=items, total=len(items))


def workbench_metrics() -> ArchiveWorkbenchMetricsRead:
    with _workbench_session() as session:
        row = session.execute(
            text("select * from public.archive_workbench_metrics")
        ).mappings().one()
        return ArchiveWorkbenchMetricsRead.model_validate(dict(row))


def cutover_control() -> ArchiveCutoverControlRead:
    with _workbench_session() as session:
        row = session.execute(
            text(
                """
                select state, version, reason, changed_by, changed_at
                from public.archive_publication_cutover_control
                where singleton = true
                """
            )
        ).mappings().one()
        return ArchiveCutoverControlRead.model_validate(dict(row))


def set_cutover_control(
    command: ArchiveCutoverCommand,
    identity: RequestIdentity,
) -> ArchiveCutoverControlRead:
    try:
        with _workbench_session() as session:
            row = session.execute(
                text(
                    """
                    select *
                    from public.set_archive_publication_cutover(
                      :actor_id,
                      :expected_version,
                      :state,
                      :idempotency_key,
                      :payload_sha256,
                      :reason,
                      :correlation_id,
                      cast(:roles as jsonb),
                      cast(:capabilities as jsonb),
                      :recent_auth
                    )
                    """
                ),
                {
                    "actor_id": identity.account_id,
                    "expected_version": command.expected_version,
                    "state": command.state,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha256": cutover_payload_sha256(command),
                    "reason": command.reason,
                    "correlation_id": command.correlation_id,
                    "roles": json.dumps(sorted(identity.roles)),
                    "capabilities": json.dumps(sorted(identity.capabilities)),
                    "recent_auth": identity.recent_auth,
                },
            ).mappings().one()
            return ArchiveCutoverControlRead(
                state=str(row["state"]),
                version=int(row["version"]),
                reason=str(row["reason"]),
                changed_by=row["changed_by"],
                changed_at=row["changed_at"],
            )
    except (IntegrityError, DBAPIError) as error:
        reason = str(error.orig)
        lowered = reason.lower()
        if "idempotency key" in lowered:
            code = "idempotency_key_reused"
            status_code = 409
        elif "version conflict" in lowered:
            code = "archive_cutover_version_conflict"
            status_code = 409
        elif "capability" in lowered or "recent authentication" in lowered:
            code = "archive_cutover_forbidden"
            status_code = 403
        else:
            code = "archive_cutover_conflict"
            status_code = 409
        raise HTTPException(
            status_code=status_code,
            detail={"code": code, "message": reason},
        ) from error


def _current_versions(session: Session) -> tuple[str, str]:
    row = session.execute(
        text(
            """
            select
              coalesce(archive_batch.data_version, 'unpublished') as archive_version,
              coalesce(public_batch.data_version, 'unpublished') as public_version
            from public.archive_release_pointer archive_pointer
            cross join public.public_release_pointer public_pointer
            left join public.publication_batches archive_batch
              on archive_batch.id = archive_pointer.latest_release_id
            left join public.publication_batches public_batch
              on public_batch.id = public_pointer.active_batch_id
            where archive_pointer.singleton = true
              and public_pointer.singleton = true
            """
        )
    ).mappings().one()
    return str(row["archive_version"]), str(row["public_version"])


def workbench_detail(item_id: UUID) -> ArchiveWorkbenchDetailRead:
    with _workbench_session() as session:
        item_row = session.execute(
            text("select * from public.archive_workbench_queue where item_id = :item_id"),
            {"item_id": item_id},
        ).mappings().first()
        if item_row is None:
            raise HTTPException(status_code=404, detail={"code": "workbench_item_not_found"})
        item = _item(item_row)
        archive_version, public_version = _current_versions(session)

        change_set_id: UUID | None = None
        governance_mode: str | None = None
        validation_state: str | None = None
        validation_hash: str | None = None
        validation_issues: list[dict[str, object]] = []
        structured_diff: list[ArchiveRevisionEvidenceRead] = []
        source_evidence: list[dict[str, object]] = []
        attachment_evidence: list[dict[str, object]] = []
        release_notes: str | None = None
        public_impact: dict[str, object] = {}
        operation_effect: dict[str, object] = {}
        operation_subject: dict[str, object] | None = None
        actor_roles: list[str] = []
        actor_capabilities: list[str] = []
        emergency_followup_due_at = None
        emergency_followup_change_set_id = None

        if item.item_type == "change_set":
            change_set_id = item.item_id
        elif item.item_type == "release":
            row = session.execute(
                text(
                    """
                    select change_set_id, reason
                    from public.archive_release_evidence evidence
                    join public.publication_batches batch on batch.id = evidence.release_id
                    where evidence.release_id = :release_id
                    """
                ),
                {"release_id": item.release_id},
            ).mappings().first()
            if row is not None:
                change_set_id = row["change_set_id"]
                release_notes = str(row["reason"])
        else:
            operation = session.execute(
                text(
                    """
                    select
                      record.*, completion.followup_change_set_id
                    from public.archive_operation_records record
                    left join public.archive_emergency_followup_completions completion
                      on completion.operation_id = record.operation_id
                    where record.operation_id = :operation_id
                    """
                ),
                {"operation_id": item.operation_id},
            ).mappings().one()
            operation_effect = _json_object(operation["effect_payload"])
            public_impact = _json_object(operation["impact_preview"])
            operation_subject = (
                _json_object(operation["subject"])
                if operation["subject"] is not None
                else None
            )
            actor_roles = _string_array(operation["actor_role_snapshot"])
            actor_capabilities = _string_array(operation["actor_capability_snapshot"])
            release_notes = str(operation["reason"])
            emergency_followup_due_at = operation["followup_due_at"]
            emergency_followup_change_set_id = operation["followup_change_set_id"]

        if change_set_id is not None:
            change_set = session.execute(
                text(
                    """
                    select governance_mode, validation_state, last_validation_hash,
                           validation_reason
                    from public.change_sets
                    where id = :change_set_id
                    """
                ),
                {"change_set_id": change_set_id},
            ).mappings().first()
            if change_set is not None:
                governance_mode = str(change_set["governance_mode"])
                validation_state = str(change_set["validation_state"])
                validation_hash = (
                    str(change_set["last_validation_hash"])
                    if change_set["last_validation_hash"] is not None
                    else None
                )
                release_notes = release_notes or str(change_set["validation_reason"] or "")

            validation = session.execute(
                text(
                    """
                    select issues, revision_evidence, source_evidence,
                           attachment_evidence, actor_role_snapshot
                    from public.archive_validation_results
                    where change_set_id = :change_set_id
                    order by created_at desc
                    limit 1
                    """
                ),
                {"change_set_id": change_set_id},
            ).mappings().first()
            if validation is not None:
                validation_issues = _json_array(validation["issues"])
                structured_diff = [
                    ArchiveRevisionEvidenceRead.model_validate(row)
                    for row in _json_array(validation["revision_evidence"])
                ]
                source_evidence = _json_array(validation["source_evidence"])
                attachment_evidence = _json_array(validation["attachment_evidence"])
                actor_roles = _string_array(validation["actor_role_snapshot"])

        return ArchiveWorkbenchDetailRead(
            item=item,
            current_archive_version=archive_version,
            current_public_version=public_version,
            change_set_id=change_set_id,
            governance_mode=governance_mode,
            validation_state=validation_state,
            validation_hash=validation_hash,
            validation_issues=validation_issues,
            structured_diff=structured_diff,
            source_evidence=source_evidence,
            attachment_evidence=attachment_evidence,
            release_notes=release_notes or None,
            public_impact=public_impact,
            operation_effect=operation_effect,
            operation_subject=operation_subject,
            actor_roles=actor_roles,
            actor_capabilities=actor_capabilities,
            emergency_followup_due_at=emergency_followup_due_at,
            emergency_followup_change_set_id=emergency_followup_change_set_id,
        )


def rehearsal_snapshot() -> ArchiveRehearsalSnapshotRead:
    with _workbench_session() as session:
        old_rows = session.execute(
            text(
                """
                select status, count(*)::integer as count
                from public.change_sets
                where governance_mode = 'four-eyes-v1'
                group by status order by status
                """
            )
        ).mappings().all()
        accountable_rows = session.execute(
            text(
                """
                select status, count(*)::integer as count
                from public.change_sets
                where governance_mode = 'single-accountable-approver-v1'
                group by status order by status
                """
            )
        ).mappings().all()
        release_rows = session.execute(
            text(
                """
                select operation, count(*)::integer as count
                from public.publication_batches
                group by operation order by operation
                """
            )
        ).mappings().all()
        orphan = session.execute(
            text(
                """
                select
                  (select count(*) from public.archive_release_evidence evidence
                    left join public.publication_batches batch on batch.id = evidence.release_id
                    where batch.id is null)::integer as release_evidence,
                  (select count(*) from public.archive_operation_records operation
                    left join public.publication_batches batch on batch.id = operation.release_id
                    where batch.id is null)::integer as operations,
                  (select count(*) from public.archive_operation_activity_events event
                    left join integration.outbox_events outbox on outbox.event_id = event.source_event_id
                    where outbox.event_id is null)::integer as activity_events
                """
            )
        ).mappings().one()
        pointer = session.execute(
            text(
                """
                select archive_pointer.latest_release_id, public_pointer.active_batch_id
                from public.archive_release_pointer archive_pointer
                cross join public.public_release_pointer public_pointer
                where archive_pointer.singleton = true and public_pointer.singleton = true
                """
            )
        ).mappings().one()
        audit_count = int(
            session.execute(
                text(
                    """
                    select count(*)
                    from public.audit_events
                    where event_type like 'archive.%'
                       or event_type like 'change_set.%'
                       or event_type like 'publication_batch.%'
                    """
                )
            ).scalar_one()
        )

        old_counts = {str(row["status"]): int(row["count"]) for row in old_rows}
        accountable_counts = {
            str(row["status"]): int(row["count"]) for row in accountable_rows
        }
        release_counts = {
            str(row["operation"]): int(row["count"]) for row in release_rows
        }
        orphan_counts = {key: int(value) for key, value in dict(orphan).items()}
        blockers = [
            f"orphan_{key}:{value}"
            for key, value in orphan_counts.items()
            if value > 0
        ]
        canonical = {
            "old_state_counts": old_counts,
            "accountable_state_counts": accountable_counts,
            "release_counts": release_counts,
            "orphan_counts": orphan_counts,
            "historical_audit_count": audit_count,
            "archive_pointer_release_id": str(pointer["latest_release_id"] or ""),
            "public_pointer_release_id": str(pointer["active_batch_id"] or ""),
        }
        digest = sha256(
            json.dumps(canonical, separators=(",", ":"), sort_keys=True).encode()
        ).hexdigest()
        return ArchiveRehearsalSnapshotRead(
            generated_at=datetime.now(UTC),
            old_state_counts=old_counts,
            accountable_state_counts=accountable_counts,
            release_counts=release_counts,
            orphan_counts=orphan_counts,
            historical_audit_count=audit_count,
            archive_pointer_release_id=pointer["latest_release_id"],
            public_pointer_release_id=pointer["active_batch_id"],
            canonical_sha256=digest,
            go=not blockers,
            blockers=blockers,
        )
