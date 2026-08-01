from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.archive_operations.models import (
    ArchiveCorrectionCommand,
    ArchiveEmergencyTakedownCommand,
    ArchiveImpactPreview,
    ArchiveMergeSplitCommand,
    ArchiveOperationMetricsRead,
    ArchiveOperationRead,
    ArchiveOperationType,
    ArchiveRollbackCommand,
    EmergencyFollowupCommand,
    EmergencyFollowupRead,
    operation_payload_sha256,
)
from app.archive_publication.models import ArchiveRiskLevel
from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import RequestIdentity


@contextmanager
def _operation_session(*, propagate_sqlalchemy_errors: bool = False) -> Iterator[Session]:
    if not settings.archive_single_accountable_approver_enabled:
        raise HTTPException(
            status_code=404,
            detail={"code": "accountable_archive_operations_disabled"},
        )
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
        if propagate_sqlalchemy_errors:
            raise
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


def _operation_read(session: Session, operation_id: UUID) -> ArchiveOperationRead:
    row = session.execute(
        text(
            """
            select
              record.operation_id,
              record.release_id,
              record.operation_type,
              record.target_release_id,
              record.subject,
              record.source_entities,
              record.destination_entities,
              record.effect_payload,
              record.impact_preview,
              record.risk_level,
              record.actor_account_id,
              record.reason,
              record.correlation_id,
              record.outbox_event_id,
              record.followup_due_at,
              record.created_at,
              case when public_pointer.active_batch_id = record.release_id
                then 'projected' else 'pending' end as projection_status
            from public.archive_operation_records record
            cross join public.public_release_pointer public_pointer
            where record.operation_id = :operation_id
              and public_pointer.singleton = true
            """
        ),
        {"operation_id": operation_id},
    ).mappings().one()
    subject = _json_object(row["subject"]) if row["subject"] is not None else None
    return ArchiveOperationRead(
        operation_id=row["operation_id"],
        release_id=row["release_id"],
        operation_type=ArchiveOperationType(str(row["operation_type"])),
        target_release_id=row["target_release_id"],
        subject=subject,
        source_entities=_json_array(row["source_entities"]),
        destination_entities=_json_array(row["destination_entities"]),
        risk_level=ArchiveRiskLevel(str(row["risk_level"])),
        effect_payload=_json_object(row["effect_payload"]),
        impact_preview=ArchiveImpactPreview.model_validate(
            _json_object(row["impact_preview"])
        ),
        actor_account_id=row["actor_account_id"],
        reason=str(row["reason"]),
        correlation_id=row["correlation_id"],
        outbox_event_id=row["outbox_event_id"],
        public_projection_status=str(row["projection_status"]),
        followup_due_at=row["followup_due_at"],
        created_at=row["created_at"],
    )


def _raise_operation_error(error: DBAPIError) -> None:
    reason = str(error.orig)
    lowered = reason.lower()
    sqlstate = getattr(error.orig, "sqlstate", None)
    if "idempotency key" in lowered or sqlstate == "23505":
        status_code = 409
        code = "idempotency_key_reused"
    elif "version conflict" in lowered or sqlstate == "40001":
        status_code = 409
        code = "archive_release_version_conflict"
    elif sqlstate == "42501":
        status_code = 403
        code = "archive_operation_forbidden"
    elif sqlstate == "P0002" or "missing" in lowered or "not found" in lowered:
        status_code = 404
        code = "archive_operation_target_not_found"
    elif "reduce public exposure" in lowered:
        status_code = 409
        code = "emergency_takedown_must_reduce_exposure"
    else:
        status_code = 409
        code = "archive_operation_conflict"
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": reason},
    ) from error


def _execute_operation(
    *,
    operation_type: ArchiveOperationType,
    expected_archive_release_id: UUID,
    target_release_id: UUID | None,
    idempotency_key: str,
    reason: str,
    data_version: str,
    public_schema_version: str,
    database_migration_version: str,
    projection_code_version: str,
    risk_level: ArchiveRiskLevel,
    correlation_id: UUID,
    subject: dict[str, object] | None,
    source_entities: list[dict[str, object]],
    destination_entities: list[dict[str, object]],
    effect_payload: dict[str, object],
    impact_preview: ArchiveImpactPreview,
    payload_sha256: str,
    identity: RequestIdentity,
) -> ArchiveOperationRead:
    try:
        with _operation_session(propagate_sqlalchemy_errors=True) as session:
            row = session.execute(
                text(
                    """
                    select *
                    from public.execute_accountable_archive_operation(
                      :operation_type,
                      :expected_archive_release_id,
                      :target_release_id,
                      :actor_id,
                      :idempotency_key,
                      :payload_sha256,
                      :reason,
                      :data_version,
                      :public_schema_version,
                      :database_migration_version,
                      :projection_code_version,
                      :risk_level,
                      cast(:subject as jsonb),
                      cast(:source_entities as jsonb),
                      cast(:destination_entities as jsonb),
                      cast(:effect_payload as jsonb),
                      cast(:impact_preview as jsonb),
                      :correlation_id,
                      cast(:roles as jsonb),
                      cast(:capabilities as jsonb),
                      :recent_auth
                    )
                    """
                ),
                {
                    "operation_type": operation_type.value,
                    "expected_archive_release_id": expected_archive_release_id,
                    "target_release_id": target_release_id,
                    "actor_id": identity.account_id,
                    "idempotency_key": idempotency_key,
                    "payload_sha256": payload_sha256,
                    "reason": reason,
                    "data_version": data_version,
                    "public_schema_version": public_schema_version,
                    "database_migration_version": database_migration_version,
                    "projection_code_version": projection_code_version,
                    "risk_level": risk_level.value,
                    "subject": json.dumps(subject) if subject is not None else None,
                    "source_entities": json.dumps(source_entities),
                    "destination_entities": json.dumps(destination_entities),
                    "effect_payload": json.dumps(effect_payload),
                    "impact_preview": json.dumps(
                        impact_preview.model_dump(mode="json")
                    ),
                    "correlation_id": correlation_id,
                    "roles": json.dumps(sorted(identity.roles)),
                    "capabilities": json.dumps(sorted(identity.capabilities)),
                    "recent_auth": identity.recent_auth,
                },
            ).mappings().one()
            return _operation_read(session, row["operation_id"])
    except OperationalError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "authoritative_database_unavailable"},
        ) from error
    except (IntegrityError, DBAPIError) as error:
        _raise_operation_error(error)


def rollback_release(
    command: ArchiveRollbackCommand,
    identity: RequestIdentity,
) -> ArchiveOperationRead:
    return _execute_operation(
        operation_type=ArchiveOperationType.ROLLBACK,
        expected_archive_release_id=command.expected_archive_release_id,
        target_release_id=command.target_release_id,
        idempotency_key=command.idempotency_key,
        reason=command.reason,
        data_version=command.data_version,
        public_schema_version=command.public_schema_version,
        database_migration_version=command.database_migration_version,
        projection_code_version=command.projection_code_version,
        risk_level=command.risk_level,
        correlation_id=command.correlation_id,
        subject=None,
        source_entities=[],
        destination_entities=[],
        effect_payload={"complex_rollback": command.complex_rollback},
        impact_preview=ArchiveImpactPreview(),
        payload_sha256=operation_payload_sha256(command),
        identity=identity,
    )


def correct_or_retract(
    command: ArchiveCorrectionCommand,
    identity: RequestIdentity,
) -> ArchiveOperationRead:
    return _execute_operation(
        operation_type=ArchiveOperationType(command.operation_type),
        expected_archive_release_id=command.expected_archive_release_id,
        target_release_id=None,
        idempotency_key=command.idempotency_key,
        reason=command.reason,
        data_version=command.data_version,
        public_schema_version=command.public_schema_version,
        database_migration_version=command.database_migration_version,
        projection_code_version=command.projection_code_version,
        risk_level=command.risk_level,
        correlation_id=command.correlation_id,
        subject=command.subject.model_dump(mode="json"),
        source_entities=[],
        destination_entities=[],
        effect_payload={
            **command.effect_payload,
            "notification_eligible": command.notification_eligible,
        },
        impact_preview=command.impact_preview,
        payload_sha256=operation_payload_sha256(command),
        identity=identity,
    )


def merge_or_split(
    command: ArchiveMergeSplitCommand,
    identity: RequestIdentity,
) -> ArchiveOperationRead:
    return _execute_operation(
        operation_type=ArchiveOperationType(command.operation_type),
        expected_archive_release_id=command.expected_archive_release_id,
        target_release_id=None,
        idempotency_key=command.idempotency_key,
        reason=command.reason,
        data_version=command.data_version,
        public_schema_version=command.public_schema_version,
        database_migration_version=command.database_migration_version,
        projection_code_version=command.projection_code_version,
        risk_level=command.risk_level,
        correlation_id=command.correlation_id,
        subject=None,
        source_entities=[item.model_dump(mode="json") for item in command.source_entities],
        destination_entities=[
            item.model_dump(mode="json") for item in command.destination_entities
        ],
        effect_payload={
            **command.effect_payload,
            "alias_redirects": command.alias_redirects,
        },
        impact_preview=command.impact_preview,
        payload_sha256=operation_payload_sha256(command),
        identity=identity,
    )


def emergency_takedown(
    command: ArchiveEmergencyTakedownCommand,
    identity: RequestIdentity,
) -> ArchiveOperationRead:
    return _execute_operation(
        operation_type=ArchiveOperationType.EMERGENCY_TAKEDOWN,
        expected_archive_release_id=command.expected_archive_release_id,
        target_release_id=None,
        idempotency_key=command.idempotency_key,
        reason=command.reason,
        data_version=command.data_version,
        public_schema_version=command.public_schema_version,
        database_migration_version=command.database_migration_version,
        projection_code_version=command.projection_code_version,
        risk_level=command.risk_level,
        correlation_id=command.correlation_id,
        subject=command.subject.model_dump(mode="json"),
        source_entities=[],
        destination_entities=[],
        effect_payload={
            **command.effect_payload,
            "public_scope": command.public_scope,
            "reduction_only": command.reduction_only,
        },
        impact_preview=command.impact_preview,
        payload_sha256=operation_payload_sha256(command),
        identity=identity,
    )


def complete_emergency_followup(
    command: EmergencyFollowupCommand,
    identity: RequestIdentity,
) -> EmergencyFollowupRead:
    payload_sha256 = operation_payload_sha256(command)
    try:
        with _operation_session(propagate_sqlalchemy_errors=True) as session:
            row = session.execute(
                text(
                    """
                    select *
                    from public.complete_emergency_takedown_followup(
                      :operation_id,
                      :followup_change_set_id,
                      :actor_id,
                      :idempotency_key,
                      :payload_sha256,
                      :reason,
                      :correlation_id,
                      cast(:capabilities as jsonb),
                      :recent_auth
                    )
                    """
                ),
                {
                    "operation_id": command.expected_operation_id,
                    "followup_change_set_id": command.followup_change_set_id,
                    "actor_id": identity.account_id,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha256": payload_sha256,
                    "reason": command.reason,
                    "correlation_id": command.correlation_id,
                    "capabilities": json.dumps(sorted(identity.capabilities)),
                    "recent_auth": identity.recent_auth,
                },
            ).mappings().one()
            return EmergencyFollowupRead(
                operation_id=row["operation_id"],
                followup_change_set_id=row["followup_change_set_id"],
                completed_by=row["completed_by"],
                completed_at=row["completed_at"],
                correlation_id=row["correlation_id"],
            )
    except OperationalError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "authoritative_database_unavailable"},
        ) from error
    except (IntegrityError, DBAPIError) as error:
        _raise_operation_error(error)


def operation_metrics() -> ArchiveOperationMetricsRead:
    with _operation_session() as session:
        row = session.execute(
            text("select * from public.archive_operation_metrics")
        ).mappings().one()
        return ArchiveOperationMetricsRead.model_validate(dict(row))
