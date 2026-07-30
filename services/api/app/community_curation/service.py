from __future__ import annotations

import json
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app.community_curation.models import (
    AssertionBridgeRead,
    CommunityBridgeCommand,
    CommunityCurationMetricsRead,
    ProjectionOutcome,
    ProjectionResultRead,
    RecordProjectionCommand,
    RecordReleaseCommand,
    ReleaseObservationRead,
    command_payload_sha256,
)
from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import RequestIdentity


@contextmanager
def _bridge_session() -> Iterator[Session]:
    if not settings.community_curation_bridge_enabled:
        raise HTTPException(
            status_code=404,
            detail={"code": "community_curation_bridge_disabled"},
        )
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
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


def _json_list(value: object) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        loaded = json.loads(value)
        if isinstance(loaded, list):
            return loaded
    return list(value) if not isinstance(value, (str, bytes, dict)) else []


def _bridge_read_from_row(row: object) -> AssertionBridgeRead:
    if not isinstance(row, dict):
        row = dict(row)  # type: ignore[arg-type]
    return AssertionBridgeRead(
        bridge_id=row["bridge_id"],
        review_case_id=row["review_case_id"],
        submission_id=row["submission_id"],
        revision_number=row["revision_number"],
        decision_id=row["decision_id"],
        change_set_id=row["change_set_id"],
        contributor_account_id=row["contributor_account_id"],
        target_type=row["target_type"],
        target_id=row["target_id"],
        base_archive_version=row["base_archive_version"],
        risk_level=row["risk_level"],
        selected_assertion_keys=[
            str(value) for value in _json_list(row["selected_assertion_keys"])
        ],
        not_recommended_assertion_keys=[
            str(value) for value in _json_list(row["not_recommended_assertion_keys"])
        ],
        source_ids=[UUID(str(value)) for value in _json_list(row["source_ids"])],
        attachment_ids=[UUID(str(value)) for value in _json_list(row["attachment_ids"])],
        actor_account_id=row["actor_account_id"],
        actor_role_snapshot=[str(value) for value in _json_list(row["actor_role_snapshot"])],
        status=row["status"],
        change_set_status=row["change_set_status"],
        governance_mode=row["governance_mode"],
        validation_state=row["validation_state"],
        published_release_id=row["published_release_id"],
        observed_release_id=row["observed_release_id"],
        observed_data_version=row["observed_data_version"],
        projection_result_id=row["projection_result_id"],
        projection_outcome=(
            ProjectionOutcome(row["projection_outcome"]) if row["projection_outcome"] else None
        ),
        public_version=row["public_version"],
        notification_intent_id=row["notification_intent_id"],
        stuck=row["stuck"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _get_bridge(session: Session, bridge_id: UUID) -> AssertionBridgeRead:
    row = session.execute(
        text(
            """
            select *
            from community_curation.assertion_bridge_queue
            where bridge_id = :bridge_id
            """
        ),
        {"bridge_id": bridge_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "assertion_bridge_not_found"})
    return _bridge_read_from_row(row)


def _sql_conflict(error: Exception) -> HTTPException:
    if isinstance(error, IntegrityError):
        return HTTPException(status_code=409, detail={"code": "bridge_integrity_conflict"})
    if isinstance(error, DBAPIError):
        sqlstate = getattr(getattr(error, "orig", None), "sqlstate", None)
        message = str(getattr(error, "orig", error))
        if sqlstate in {"40001", "23505"}:
            return HTTPException(
                status_code=409,
                detail={"code": "bridge_conflict", "message": message},
            )
        if sqlstate == "42501":
            return HTTPException(
                status_code=403,
                detail={"code": "bridge_forbidden", "message": message},
            )
        if sqlstate in {"23514", "P0002"}:
            return HTTPException(
                status_code=409,
                detail={"code": "bridge_policy_conflict", "message": message},
            )
    return HTTPException(status_code=500, detail={"code": "community_curation_bridge_failed"})


def create_bridge(
    review_case_id: UUID,
    command: CommunityBridgeCommand,
    identity: RequestIdentity,
) -> AssertionBridgeRead:
    with _bridge_session() as session:
        try:
            row = session.execute(
                text(
                    """
                    select bridge_id, change_set_id
                    from community_curation.create_assertion_bridge(
                      :review_case_id, :actor_id, :expected_version,
                      :idempotency_key, :payload_sha, :reason, :base_archive_version,
                      :risk_level, :correlation_id, cast(:actor_roles as jsonb)
                    )
                    """
                ),
                {
                    "review_case_id": review_case_id,
                    "actor_id": identity.account_id,
                    "expected_version": command.expected_version,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha": command_payload_sha256(command),
                    "reason": command.reason,
                    "base_archive_version": command.base_archive_version,
                    "risk_level": command.risk_level.value,
                    "correlation_id": command.correlation_id,
                    "actor_roles": json.dumps(sorted(identity.roles)),
                },
            ).mappings().one()
        except Exception as error:
            raise _sql_conflict(error) from error
        return _get_bridge(session, row["bridge_id"])


def get_bridge(bridge_id: UUID) -> AssertionBridgeRead:
    with _bridge_session() as session:
        return _get_bridge(session, bridge_id)


def record_release(
    release_id: UUID,
    command: RecordReleaseCommand,
    identity: RequestIdentity,
) -> ReleaseObservationRead:
    with _bridge_session() as session:
        try:
            row = session.execute(
                text(
                    """
                    select bridge_id, change_set_id, release_id
                    from community_curation.record_archive_release(
                      :release_id, :actor_id, :idempotency_key, :payload_sha,
                      :correlation_id
                    )
                    """
                ),
                {
                    "release_id": release_id,
                    "actor_id": identity.account_id,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha": command_payload_sha256(command),
                    "correlation_id": command.correlation_id,
                },
            ).mappings().one()
        except Exception as error:
            raise _sql_conflict(error) from error
        return ReleaseObservationRead(**row)


def record_projection(
    bridge_id: UUID,
    release_id: UUID,
    command: RecordProjectionCommand,
    identity: RequestIdentity,
) -> ProjectionResultRead:
    with _bridge_session() as session:
        try:
            row = session.execute(
                text(
                    """
                    select projection_result_id, contributor_status, notification_intent_id
                    from community_curation.record_projection_result(
                      :bridge_id, :release_id, :actor_id, :projection_event_id,
                      :outcome, :public_version, cast(:incorporated_keys as jsonb),
                      :message, :idempotency_key, :payload_sha, :correlation_id
                    )
                    """
                ),
                {
                    "bridge_id": bridge_id,
                    "release_id": release_id,
                    "actor_id": identity.account_id,
                    "projection_event_id": command.projection_event_id,
                    "outcome": command.outcome.value,
                    "public_version": command.public_version,
                    "incorporated_keys": json.dumps(command.incorporated_assertion_keys),
                    "message": command.user_visible_message,
                    "idempotency_key": command.idempotency_key,
                    "payload_sha": command_payload_sha256(command),
                    "correlation_id": command.correlation_id,
                },
            ).mappings().one()
        except Exception as error:
            raise _sql_conflict(error) from error
        return ProjectionResultRead(**row)


def bridge_metrics() -> CommunityCurationMetricsRead:
    with _bridge_session() as session:
        row = session.execute(
            text(
                """
                select *
                from community_curation.chain_integrity_metrics
                """
            )
        ).mappings().one()
        return CommunityCurationMetricsRead(**dict(row))
