from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from hashlib import sha256
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableReleaseRead,
    AccountableValidationCommand,
    AccountableValidationRead,
    ArchivePublicationMetricsRead,
    ArchiveRiskLevel,
    ArchiveValidationIssueRead,
    ArchiveValidationOutcome,
    command_payload_sha256,
)
from app.core.config import settings
from app.db.session import has_database, session_scope
from app.domain.publication_workflow import EntityRevision, preview_revisions
from app.identity.models import RequestIdentity
from app.services import publication_repository


@contextmanager
def _archive_session() -> Iterator[Session]:
    if not settings.archive_single_accountable_approver_enabled:
        raise HTTPException(
            status_code=404,
            detail={"code": "accountable_archive_publication_disabled"},
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
    raise HTTPException(status_code=409, detail={"code": "invalid_revision_payload"})


def _json_array(value: object) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, list):
            return loaded
    return []


def _load_change_set(session: Session, change_set_id: UUID, *, lock: bool = False):
    suffix = " for update" if lock else ""
    row = session.execute(
        text(
            f"""
            select
              id, title, reason, status, created_by, governance_mode,
              validation_state, validated_by, validated_at, validation_reason,
              base_archive_version, governance_version, risk_level,
              origin_context, origin_actor_id, last_validation_hash,
              published_release_id
            from public.change_sets
            where id = :change_set_id{suffix}
            """
        ),
        {"change_set_id": change_set_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "change_set_not_found"})
    return row


def _load_revisions(session: Session, change_set_id: UUID) -> tuple[EntityRevision, ...]:
    rows = session.execute(
        text(
            """
            select
              revision.id, revision.entity_type, revision.entity_id,
              revision.revision_number, revision.payload, revision.created_by,
              revision.substantive_modified_by
            from public.change_set_revisions link
            join public.entity_revisions revision on revision.id = link.revision_id
            where link.change_set_id = :change_set_id
            order by revision.entity_type, revision.entity_id, revision.revision_number
            """
        ),
        {"change_set_id": change_set_id},
    ).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=409,
            detail={"code": "change_set_has_no_revisions"},
        )
    return tuple(
        EntityRevision(
            id=row["id"],
            entity_type=str(row["entity_type"]),
            entity_id=str(row["entity_id"]),
            revision_number=int(row["revision_number"]),
            payload=_json_object(row["payload"]),
            created_by=row["created_by"],
            substantive_modified_by=row["substantive_modified_by"],
        )
        for row in rows
    )


def _current_archive_version(session: Session, *, lock: bool = False) -> str:
    suffix = " for update of pointer" if lock else ""
    row = session.execute(
        text(
            f"""
            select release.data_version
            from public.archive_release_pointer pointer
            left join public.publication_batches release
              on release.id = pointer.latest_release_id
            where pointer.singleton = true{suffix}
            """
        )
    ).first()
    if row is None or row[0] is None:
        return "unpublished"
    return str(row[0])


def _validation_receipt(
    session: Session,
    identity: RequestIdentity,
    idempotency_key: str,
    payload_sha256: str,
) -> UUID | None:
    row = session.execute(
        text(
            """
            select command_name, command_payload_sha256, validation_result_id
            from public.archive_command_receipts
            where actor_account_id = :actor_account_id
              and idempotency_key = :idempotency_key
            """
        ),
        {
            "actor_account_id": identity.account_id,
            "idempotency_key": idempotency_key,
        },
    ).mappings().first()
    if row is None:
        return None
    if (
        row["command_name"] != "validate_change_set"
        or row["command_payload_sha256"] != payload_sha256
    ):
        raise HTTPException(
            status_code=409,
            detail={"code": "idempotency_key_reused"},
        )
    return row["validation_result_id"]


def _validation_read(session: Session, validation_result_id: UUID) -> AccountableValidationRead:
    row = session.execute(
        text(
            """
            select
              validation_result_id, change_set_id, outcome, risk_level,
              base_archive_version, validation_hash, governance_version,
              validated_by, created_at, reason, issues
            from public.archive_validation_results
            where validation_result_id = :validation_result_id
            """
        ),
        {"validation_result_id": validation_result_id},
    ).mappings().one()
    return AccountableValidationRead(
        validation_result_id=row["validation_result_id"],
        change_set_id=row["change_set_id"],
        outcome=ArchiveValidationOutcome(str(row["outcome"])),
        risk_level=ArchiveRiskLevel(str(row["risk_level"])),
        base_archive_version=str(row["base_archive_version"]),
        validation_hash=str(row["validation_hash"]),
        governance_version=int(row["governance_version"]),
        validated_by=row["validated_by"],
        validated_at=row["created_at"],
        reason=str(row["reason"]),
        issues=[
            ArchiveValidationIssueRead.model_validate(item)
            for item in _json_array(row["issues"])
        ],
    )


def _revision_evidence(revisions: tuple[EntityRevision, ...]) -> list[dict[str, Any]]:
    return [
        {
            "revision_id": str(revision.id),
            "entity_type": revision.entity_type,
            "entity_id": revision.entity_id,
            "revision_number": revision.revision_number,
            "created_by": str(revision.created_by),
            "substantive_modified_by": str(revision.substantive_modified_by),
            "payload_sha256": sha256(
                json.dumps(
                    revision.payload,
                    separators=(",", ":"),
                    sort_keys=True,
                ).encode("utf-8")
            ).hexdigest(),
        }
        for revision in revisions
    ]


def _source_evidence(revisions: tuple[EntityRevision, ...]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for revision in revisions:
        checks = revision.payload.get("publication_checks")
        if not isinstance(checks, dict):
            continue
        for source in checks.get("sources", []):
            if isinstance(source, dict):
                result.append(
                    {
                        "revision_id": str(revision.id),
                        "entity_type": revision.entity_type,
                        "entity_id": revision.entity_id,
                        **source,
                    }
                )
    return result


def _attachment_evidence(revisions: tuple[EntityRevision, ...]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for revision in revisions:
        checks = revision.payload.get("publication_checks")
        if not isinstance(checks, dict):
            continue
        for media in checks.get("media", []):
            if isinstance(media, dict):
                result.append(
                    {
                        "revision_id": str(revision.id),
                        "entity_type": revision.entity_type,
                        "entity_id": revision.entity_id,
                        **media,
                    }
                )
    return result


def _validation_hash(
    *,
    change_set_id: UUID,
    base_archive_version: str,
    risk_level: ArchiveRiskLevel,
    revision_evidence: list[dict[str, Any]],
    issues: list[dict[str, Any]],
) -> str:
    payload = {
        "policy": "single-accountable-approver-v1",
        "change_set_id": str(change_set_id),
        "base_archive_version": base_archive_version,
        "risk_level": risk_level.value,
        "revision_evidence": revision_evidence,
        "issues": issues,
    }
    return sha256(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).hexdigest()


def validate_change_set(
    change_set_id: UUID,
    command: AccountableValidationCommand,
    identity: RequestIdentity,
) -> AccountableValidationRead:
    payload_sha256 = command_payload_sha256(command)
    with _archive_session() as session:
        replay = _validation_receipt(
            session,
            identity,
            command.idempotency_key,
            payload_sha256,
        )
        if replay is not None:
            return _validation_read(session, replay)

        change_set = _load_change_set(session, change_set_id, lock=True)
        if int(change_set["governance_version"]) != command.expected_version:
            raise HTTPException(
                status_code=409,
                detail={"code": "change_set_version_conflict"},
            )
        if str(change_set["status"]) in {
            "publishing",
            "published",
            "superseded",
            "rolled_back",
            "withdrawn",
        }:
            raise HTTPException(
                status_code=409,
                detail={"code": "change_set_is_immutable"},
            )

        current_archive_version = _current_archive_version(session, lock=True)
        if command.base_archive_version != current_archive_version:
            session.execute(
                text(
                    """
                    insert into public.archive_publication_failures (
                      change_set_id, actor_account_id, failure_type, reason, correlation_id
                    ) values (
                      :change_set_id, :actor_account_id, 'stale_base',
                      :reason, :correlation_id
                    )
                    """
                ),
                {
                    "change_set_id": change_set_id,
                    "actor_account_id": identity.account_id,
                    "reason": "Validation base Archive version is stale",
                    "correlation_id": command.correlation_id,
                },
            )
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "stale_base_archive_version",
                    "current_archive_version": current_archive_version,
                },
            )

        revisions = _load_revisions(session, change_set_id)
        hydrated = publication_repository.hydrate_revisions_for_preview(session, revisions)
        preview = preview_revisions(hydrated)
        issue_payloads = [
            {
                "category": issue.category,
                "entity_type": issue.entity_type,
                "entity_id": issue.entity_id,
                "detail": issue.detail,
            }
            for issue in preview.issues
        ]
        outcome = (
            ArchiveValidationOutcome.READY
            if preview.is_publishable
            else ArchiveValidationOutcome.VALIDATION_FAILED
        )
        revision_evidence = _revision_evidence(hydrated)
        source_evidence = _source_evidence(hydrated)
        attachment_evidence = _attachment_evidence(hydrated)
        validation_hash = _validation_hash(
            change_set_id=change_set_id,
            base_archive_version=current_archive_version,
            risk_level=command.risk_level,
            revision_evidence=revision_evidence,
            issues=issue_payloads,
        )
        next_version = command.expected_version + 1

        validation_result_id = session.execute(
            text(
                """
                insert into public.archive_validation_results (
                  change_set_id, governance_version, outcome, risk_level,
                  base_archive_version, validation_hash, issues, revision_evidence,
                  source_evidence, attachment_evidence, validated_by,
                  actor_role_snapshot, reason, correlation_id
                ) values (
                  :change_set_id, :governance_version, :outcome, :risk_level,
                  :base_archive_version, :validation_hash, cast(:issues as jsonb),
                  cast(:revision_evidence as jsonb), cast(:source_evidence as jsonb),
                  cast(:attachment_evidence as jsonb), :validated_by,
                  cast(:actor_role_snapshot as jsonb), :reason, :correlation_id
                ) returning validation_result_id
                """
            ),
            {
                "change_set_id": change_set_id,
                "governance_version": next_version,
                "outcome": outcome.value,
                "risk_level": command.risk_level.value,
                "base_archive_version": current_archive_version,
                "validation_hash": validation_hash,
                "issues": json.dumps(issue_payloads),
                "revision_evidence": json.dumps(revision_evidence),
                "source_evidence": json.dumps(source_evidence),
                "attachment_evidence": json.dumps(attachment_evidence),
                "validated_by": identity.account_id,
                "actor_role_snapshot": json.dumps(sorted(identity.roles)),
                "reason": command.reason,
                "correlation_id": command.correlation_id,
            },
        ).scalar_one()

        session.execute(
            text(
                """
                update public.change_sets
                set governance_mode = 'single-accountable-approver-v1',
                    validation_state = :validation_state,
                    status = :status,
                    validated_by = :validated_by,
                    validated_at = now(),
                    validation_reason = :reason,
                    base_archive_version = :base_archive_version,
                    governance_version = :governance_version,
                    risk_level = :risk_level,
                    last_validation_hash = :validation_hash
                where id = :change_set_id
                """
            ),
            {
                "validation_state": outcome.value,
                "status": outcome.value,
                "validated_by": identity.account_id,
                "reason": command.reason,
                "base_archive_version": current_archive_version,
                "governance_version": next_version,
                "risk_level": command.risk_level.value,
                "validation_hash": validation_hash,
                "change_set_id": change_set_id,
            },
        )
        session.execute(
            text(
                """
                insert into public.audit_events (
                  event_type, subject_type, subject_id, actor_id,
                  reason, correlation_id, metadata
                ) values (
                  'change_set.accountable_validated', 'change_set', :change_set_id,
                  :actor_id, :reason, :correlation_id,
                  cast(:metadata as jsonb)
                )
                """
            ),
            {
                "change_set_id": change_set_id,
                "actor_id": identity.account_id,
                "reason": command.reason,
                "correlation_id": command.correlation_id,
                "metadata": json.dumps(
                    {
                        "outcome": outcome.value,
                        "risk_level": command.risk_level.value,
                        "base_archive_version": current_archive_version,
                        "validation_result_id": str(validation_result_id),
                        "validation_hash": validation_hash,
                        "actor_roles": sorted(identity.roles),
                    }
                ),
            },
        )
        session.execute(
            text(
                """
                insert into public.archive_command_receipts (
                  actor_account_id, idempotency_key, command_name,
                  command_payload_sha256, change_set_id, validation_result_id
                ) values (
                  :actor_account_id, :idempotency_key, 'validate_change_set',
                  :payload_sha256, :change_set_id, :validation_result_id
                )
                """
            ),
            {
                "actor_account_id": identity.account_id,
                "idempotency_key": command.idempotency_key,
                "payload_sha256": payload_sha256,
                "change_set_id": change_set_id,
                "validation_result_id": validation_result_id,
            },
        )
        return _validation_read(session, validation_result_id)


def _release_read(session: Session, release_id: UUID) -> AccountableReleaseRead:
    row = session.execute(
        text(
            """
            select
              batch.id as release_id, evidence.change_set_id, batch.data_version,
              batch.public_schema_version, batch.database_migration_version,
              batch.projection_code_version, evidence.base_archive_version,
              batch.previous_batch_id, evidence.risk_level,
              batch.published_by, batch.published_at, batch.correlation_id,
              evidence.outbox_event_id,
              case when public_pointer.active_batch_id = batch.id
                then 'projected' else 'pending' end as projection_status
            from public.publication_batches batch
            join public.archive_release_evidence evidence on evidence.release_id = batch.id
            cross join public.public_release_pointer public_pointer
            where batch.id = :release_id and public_pointer.singleton = true
            """
        ),
        {"release_id": release_id},
    ).mappings().one()
    return AccountableReleaseRead(
        release_id=row["release_id"],
        change_set_id=row["change_set_id"],
        data_version=str(row["data_version"]),
        public_schema_version=str(row["public_schema_version"]),
        database_migration_version=str(row["database_migration_version"]),
        projection_code_version=str(row["projection_code_version"]),
        base_archive_version=str(row["base_archive_version"]),
        previous_release_id=row["previous_batch_id"],
        risk_level=ArchiveRiskLevel(str(row["risk_level"])),
        published_by=row["published_by"],
        published_at=row["published_at"],
        correlation_id=row["correlation_id"],
        outbox_event_id=row["outbox_event_id"],
        public_projection_status=str(row["projection_status"]),
    )


def _record_publish_failure(
    *,
    change_set_id: UUID,
    identity: RequestIdentity,
    correlation_id: UUID,
    failure_type: str,
    reason: str,
) -> None:
    if not has_database():
        return
    try:
        with session_scope() as session:
            if session is None:
                return
            session.execute(
                text(
                    """
                    insert into public.archive_publication_failures (
                      change_set_id, actor_account_id, failure_type, reason, correlation_id
                    ) values (
                      :change_set_id, :actor_account_id, :failure_type,
                      :reason, :correlation_id
                    )
                    """
                ),
                {
                    "change_set_id": change_set_id,
                    "actor_account_id": identity.account_id,
                    "failure_type": failure_type,
                    "reason": reason[:2000],
                    "correlation_id": correlation_id,
                },
            )
            session.commit()
    except SQLAlchemyError:
        return


def publish_change_set(
    change_set_id: UUID,
    command: AccountablePublishCommand,
    identity: RequestIdentity,
) -> AccountableReleaseRead:
    if not identity.has_capability("archive.accountable.publish"):
        raise HTTPException(status_code=403, detail={"code": "publication_capability_missing"})

    payload_sha256 = command_payload_sha256(command)
    try:
        with _archive_session() as session:
            row = session.execute(
                text(
                    """
                    select *
                    from public.publish_accountable_change_set(
                      :change_set_id, :actor_id, :expected_version,
                      :idempotency_key, :payload_sha256, :reason,
                      :data_version, :public_schema_version,
                      :database_migration_version, :projection_code_version,
                      :correlation_id, cast(:roles as jsonb),
                      cast(:capabilities as jsonb), :recent_auth
                    )
                    """
                ),
                {
                    "change_set_id": change_set_id,
                    "actor_id": identity.account_id,
                    "expected_version": command.expected_version,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha256": payload_sha256,
                    "reason": command.reason,
                    "data_version": command.data_version,
                    "public_schema_version": command.public_schema_version,
                    "database_migration_version": command.database_migration_version,
                    "projection_code_version": command.projection_code_version,
                    "correlation_id": command.correlation_id,
                    "roles": json.dumps(sorted(identity.roles)),
                    "capabilities": json.dumps(sorted(identity.capabilities)),
                    "recent_auth": identity.recent_auth,
                },
            ).mappings().one()
            return _release_read(session, row["release_id"])
    except IntegrityError as error:
        reason = str(error.orig)
        failure_type = "policy_conflict"
        _record_publish_failure(
            change_set_id=change_set_id,
            identity=identity,
            correlation_id=command.correlation_id,
            failure_type=failure_type,
            reason=reason,
        )
        raise HTTPException(
            status_code=409,
            detail={"code": "publication_conflict", "message": reason},
        ) from error
    except DBAPIError as error:
        reason = str(error.orig)
        lowered = reason.lower()
        if "base archive version is stale" in lowered:
            failure_type = "stale_base"
            code = "stale_base_archive_version"
        elif "version conflict" in lowered:
            failure_type = "version_conflict"
            code = "change_set_version_conflict"
        else:
            failure_type = "policy_conflict"
            code = "publication_policy_conflict"
        _record_publish_failure(
            change_set_id=change_set_id,
            identity=identity,
            correlation_id=command.correlation_id,
            failure_type=failure_type,
            reason=reason,
        )
        status_code = 403 if "capability" in lowered or "contributor" in lowered else 409
        raise HTTPException(
            status_code=status_code,
            detail={"code": code, "message": reason},
        ) from error


def publication_metrics() -> ArchivePublicationMetricsRead:
    with _archive_session() as session:
        row = session.execute(
            text("select * from public.archive_publication_metrics")
        ).mappings().one()
        return ArchivePublicationMetricsRead.model_validate(dict(row))
