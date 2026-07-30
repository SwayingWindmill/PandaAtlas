from __future__ import annotations

import json
from contextlib import contextmanager
from hashlib import sha256
from typing import Any, Iterator
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.review_moderation.models import (
    ClaimReviewCaseCommand,
    DecideReviewCaseCommand,
    IntakeReviewCaseCommand,
    RecommendAssertionsCommand,
    ReopenReviewCaseCommand,
    RequestInformationCommand,
    ReviewAttachmentRead,
    ReviewCaseDetail,
    ReviewCaseList,
    ReviewCaseState,
    ReviewCaseSummary,
    ReviewDecisionOutcome,
    ReviewDecisionRead,
    ReviewInformationRequestRead,
    ReviewMetricsRead,
    ReviewQueue,
    ReviewSourceRead,
    SourceVerificationOutcome,
    TriageReviewCaseCommand,
    VerifySourceCommand,
)


@contextmanager
def _review_session() -> Iterator[Session]:
    if not settings.review_moderation_enabled:
        raise HTTPException(status_code=404, detail={"code": "review_moderation_disabled"})
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


def _actor_hash(actor_account_id: UUID) -> str:
    return sha256(str(actor_account_id).encode("utf-8")).hexdigest()


def _audit(
    session: Session,
    *,
    review_case_id: UUID | None,
    submission_id: UUID | None,
    actor_account_id: UUID | None,
    event_type: str,
    outcome: str,
    reason: str | None,
    details: dict[str, Any],
    idempotency_key: str | None,
) -> None:
    session.execute(
        text(
            """
            insert into review_moderation.audit_events (
              review_case_id, submission_id, actor_account_id, event_type, outcome,
              reason, details, correlation_id, idempotency_key
            ) values (
              :review_case_id, :submission_id, :actor_account_id, :event_type, :outcome,
              :reason, cast(:details as jsonb), :correlation_id, :idempotency_key
            )
            """
        ),
        {
            "review_case_id": review_case_id,
            "submission_id": submission_id,
            "actor_account_id": actor_account_id,
            "event_type": event_type,
            "outcome": outcome,
            "reason": reason,
            "details": json.dumps(details, separators=(",", ":"), sort_keys=True),
            "correlation_id": uuid4(),
            "idempotency_key": idempotency_key,
        },
    )


def _deny(
    session: Session,
    *,
    status_code: int,
    code: str,
    message: str,
    review_case_id: UUID | None,
    submission_id: UUID | None,
    actor_account_id: UUID,
    event_type: str,
    idempotency_key: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    _audit(
        session,
        review_case_id=review_case_id,
        submission_id=submission_id,
        actor_account_id=actor_account_id,
        event_type=event_type,
        outcome="denied",
        reason=message,
        details=details or {},
        idempotency_key=idempotency_key,
    )
    session.commit()
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _replayed_case_id(
    session: Session,
    actor_account_id: UUID,
    idempotency_key: str,
    command_name: str,
) -> UUID | None:
    row = session.execute(
        text(
            """
            select command_name, review_case_id
            from review_moderation.command_receipts
            where actor_account_id = :actor_account_id
              and idempotency_key = :idempotency_key
            """
        ),
        {"actor_account_id": actor_account_id, "idempotency_key": idempotency_key},
    ).mappings().first()
    if row is None:
        return None
    if row["command_name"] != command_name:
        raise HTTPException(
            status_code=409,
            detail={"code": "idempotency_key_reused", "message": "Idempotency key reused"},
        )
    return row["review_case_id"]


def _record_receipt(
    session: Session,
    actor_account_id: UUID,
    idempotency_key: str,
    command_name: str,
    review_case_id: UUID,
) -> None:
    session.execute(
        text(
            """
            insert into review_moderation.command_receipts (
              actor_account_id, idempotency_key, command_name, review_case_id
            ) values (:actor_account_id, :idempotency_key, :command_name, :review_case_id)
            """
        ),
        {
            "actor_account_id": actor_account_id,
            "idempotency_key": idempotency_key,
            "command_name": command_name,
            "review_case_id": review_case_id,
        },
    )


def _load_case_row(session: Session, review_case_id: UUID, *, lock: bool = False):
    suffix = " for update" if lock else ""
    row = session.execute(
        text(
            f"""
            select queue.*, submission.account_id as contributor_account_id
            from review_moderation.review_case_queue queue
            join community_intake.submissions submission
              on submission.submission_id = queue.submission_id
            where queue.review_case_id = :review_case_id{suffix}
            """
        ),
        {"review_case_id": review_case_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "review_case_not_found"})
    return row


def _summary(row) -> ReviewCaseSummary:
    return ReviewCaseSummary(
        review_case_id=row["review_case_id"],
        submission_id=row["submission_id"],
        target_type=str(row["target_type"]),
        target_id=row["target_id"],
        state=ReviewCaseState(str(row["state"])),
        version=row["version"],
        opened_revision_number=row["opened_revision_number"],
        active_revision_number=row["active_revision_number"],
        primary_assignee_id=row["primary_assignee_id"],
        risk_level=row["risk_level"],
        duplicate_of_review_case_id=row["duplicate_of_review_case_id"],
        reopened_from_review_case_id=row["reopened_from_review_case_id"],
        contributor_status=str(row["contributor_status"]),
        first_response_due_at=row["first_response_due_at"],
        first_responded_at=row["first_responded_at"],
        sla_overdue=row["sla_overdue"],
        queue_age_seconds=row["queue_age_seconds"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _detail(session: Session, review_case_id: UUID) -> ReviewCaseDetail:
    row = _load_case_row(session, review_case_id)
    sources = session.execute(
        text(
            """
            select source.source_id, source.source_kind::text, source.title, source.locator,
                   source.publisher, source.published_on::text,
                   latest.outcome::text as verification_outcome,
                   latest.normalized_locator, latest.canonical_source_id,
                   latest.reason as verification_reason
            from community_intake.submitted_sources source
            left join lateral (
              select verification.outcome, verification.normalized_locator,
                     verification.canonical_source_id, verification.reason
              from review_moderation.source_verifications verification
              where verification.review_case_id = :review_case_id
                and verification.source_id = source.source_id
              order by verification.verified_at desc, verification.source_verification_id desc
              limit 1
            ) latest on true
            where source.submission_id = :submission_id
              and source.revision_number = :active_revision_number
            order by source.created_at, source.source_id
            """
        ),
        {
            "review_case_id": review_case_id,
            "submission_id": row["submission_id"],
            "active_revision_number": row["active_revision_number"],
        },
    ).mappings().all()
    attachments = session.execute(
        text(
            """
            select attachment_id, original_filename, media_type, byte_size, state::text
            from community_intake.attachments
            where submission_id = :submission_id
              and bound_revision_number = :active_revision_number
              and state <> 'deleted'
            order by created_at, attachment_id
            """
        ),
        {
            "submission_id": row["submission_id"],
            "active_revision_number": row["active_revision_number"],
        },
    ).mappings().all()
    decisions = session.execute(
        text(
            """
            select decision_id, active_revision_number, outcome::text,
                   user_visible_explanation, internal_reason, selected_assertion_keys,
                   duplicate_of_review_case_id, decided_by_account_id, decided_at
            from review_moderation.decisions
            where review_case_id = :review_case_id
            order by decided_at, decision_id
            """
        ),
        {"review_case_id": review_case_id},
    ).mappings().all()
    requests = session.execute(
        text(
            """
            select information_request_id, active_revision_number, requested_fields,
                   user_visible_message, internal_note, requested_by_account_id, created_at
            from review_moderation.information_requests
            where review_case_id = :review_case_id
            order by created_at, information_request_id
            """
        ),
        {"review_case_id": review_case_id},
    ).mappings().all()
    return ReviewCaseDetail(
        **_summary(row).model_dump(),
        contributor_account_id=row["contributor_account_id"],
        sources=[
            ReviewSourceRead(
                **source,
                verification_outcome=(
                    SourceVerificationOutcome(source["verification_outcome"])
                    if source["verification_outcome"]
                    else None
                ),
            )
            for source in sources
        ],
        attachments=[
            ReviewAttachmentRead(
                **attachment,
                clean_accessible=attachment["state"] == "clean",
            )
            for attachment in attachments
        ],
        decisions=[
            ReviewDecisionRead(
                **decision,
                outcome=ReviewDecisionOutcome(decision["outcome"]),
                selected_assertion_keys=list(decision["selected_assertion_keys"] or []),
            )
            for decision in decisions
        ],
        information_requests=[
            ReviewInformationRequestRead(
                **request,
                requested_fields=list(request["requested_fields"] or []),
            )
            for request in requests
        ],
    )


def _check_version(session: Session, row, expected_version: int, actor_id: UUID, key: str) -> None:
    if row["version"] != expected_version:
        _deny(
            session,
            status_code=409,
            code="review_case_version_conflict",
            message="ReviewCase version is stale",
            review_case_id=row["review_case_id"],
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.case.version_denied",
            idempotency_key=key,
            details={"expected": expected_version, "actual": row["version"]},
        )


def _check_not_self(session: Session, row, actor_id: UUID, key: str, event: str) -> None:
    if row["contributor_account_id"] == actor_id:
        _deny(
            session,
            status_code=403,
            code="review_self_conflict",
            message="Reviewer cannot handle their own submission",
            review_case_id=row["review_case_id"],
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type=event,
            idempotency_key=key,
        )


def _check_assignee(session: Session, row, actor_id: UUID, key: str, event: str) -> None:
    if row["primary_assignee_id"] != actor_id:
        _deny(
            session,
            status_code=409,
            code="review_case_not_assigned",
            message="ReviewCase is not assigned to this reviewer",
            review_case_id=row["review_case_id"],
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type=event,
            idempotency_key=key,
        )


def _revision_assertion_keys(session: Session, submission_id: UUID, revision_number: int) -> list[str]:
    content = session.execute(
        text(
            """
            select content
            from community_intake.submission_revisions
            where submission_id = :submission_id and revision_number = :revision_number
            """
        ),
        {"submission_id": submission_id, "revision_number": revision_number},
    ).scalar_one_or_none()
    if content is None:
        raise HTTPException(status_code=409, detail={"code": "active_revision_missing"})
    assertions = content.get("assertions", []) if isinstance(content, dict) else []
    return [
        assertion["assertion_key"]
        for assertion in assertions
        if isinstance(assertion, dict) and isinstance(assertion.get("assertion_key"), str)
    ]


def _decision_ready(session: Session, row) -> bool:
    readiness = session.execute(
        text(
            """
            with sources as (
              select source.source_id,
                     (
                       select verification.outcome::text
                       from review_moderation.source_verifications verification
                       where verification.review_case_id = :review_case_id
                         and verification.source_id = source.source_id
                       order by verification.verified_at desc, verification.source_verification_id desc
                       limit 1
                     ) as latest_outcome
              from community_intake.submitted_sources source
              where source.submission_id = :submission_id
                and source.revision_number = :active_revision_number
            )
            select
              count(*) filter (where latest_outcome is distinct from 'verified') as unverified_sources,
              (
                select count(*)
                from community_intake.attachments attachment
                where attachment.submission_id = :submission_id
                  and attachment.bound_revision_number = :active_revision_number
                  and attachment.state <> 'deleted'
                  and attachment.state <> 'clean'
              ) as unclean_attachments
            from sources
            """
        ),
        {
            "review_case_id": row["review_case_id"],
            "submission_id": row["submission_id"],
            "active_revision_number": row["active_revision_number"],
        },
    ).mappings().one()
    return readiness["unverified_sources"] == 0 and readiness["unclean_attachments"] == 0


def _project_status(
    session: Session,
    *,
    row,
    actor_id: UUID,
    status: str,
    visible_reason: str | None,
    action_required_fields: list[str],
    assertion_results: dict[str, str],
    source_event_id: UUID,
    idempotency_key: str,
) -> None:
    submission = session.execute(
        text(
            """
            select contributor_subject_hash
            from community_intake.submissions
            where submission_id = :submission_id
            for update
            """
        ),
        {"submission_id": row["submission_id"]},
    ).mappings().one()
    status_event_id = session.execute(
        text(
            """
            insert into community_intake.contributor_status_events (
              submission_id, status, active_revision_number, user_visible_reason,
              action_required_fields, source_context, source_event_id,
              actor_subject_hash, correlation_id, idempotency_key
            ) values (
              :submission_id, cast(:status as community_intake.contributor_status),
              :active_revision_number, :user_visible_reason, cast(:fields as jsonb),
              'review', :source_event_id, :actor_subject_hash, :correlation_id,
              :idempotency_key
            ) returning status_event_id
            """
        ),
        {
            "submission_id": row["submission_id"],
            "status": status,
            "active_revision_number": row["active_revision_number"],
            "user_visible_reason": visible_reason,
            "fields": json.dumps(action_required_fields),
            "source_event_id": source_event_id,
            "actor_subject_hash": _actor_hash(actor_id),
            "correlation_id": uuid4(),
            "idempotency_key": idempotency_key,
        },
    ).scalar_one()
    for assertion_key, disposition in assertion_results.items():
        session.execute(
            text(
                """
                insert into community_intake.contributor_assertion_results (
                  status_event_id, submission_id, revision_number, assertion_key,
                  disposition, explanation
                ) values (
                  :status_event_id, :submission_id, :revision_number, :assertion_key,
                  cast(:disposition as community_intake.assertion_disposition),
                  :explanation
                )
                """
            ),
            {
                "status_event_id": status_event_id,
                "submission_id": row["submission_id"],
                "revision_number": row["active_revision_number"],
                "assertion_key": assertion_key,
                "disposition": disposition,
                "explanation": visible_reason,
            },
        )
    session.execute(
        text(
            """
            update community_intake.submissions
            set contributor_status = cast(:status as community_intake.contributor_status),
                current_status_event_id = :status_event_id,
                contributor_status_updated_at = now(),
                version = version + 1,
                updated_at = now()
            where submission_id = :submission_id
            """
        ),
        {
            "status": status,
            "status_event_id": status_event_id,
            "submission_id": row["submission_id"],
        },
    )


def list_review_cases(queue: ReviewQueue, limit: int) -> ReviewCaseList:
    predicates = {
        ReviewQueue.ALL: "true",
        ReviewQueue.NEW: "state = 'new'",
        ReviewQueue.TRIAGE: "state = 'triage'",
        ReviewQueue.ASSIGNED: "state = 'assigned'",
        ReviewQueue.WAITING: "state = 'waiting'",
        ReviewQueue.DECISION_READY: "state = 'decision_ready'",
        ReviewQueue.INCORPORATION_RECOMMENDED: "state = 'incorporation_recommended'",
        ReviewQueue.CLOSED: "state = 'closed'",
        ReviewQueue.SLA_OVERDUE: "sla_overdue",
    }
    with _review_session() as session:
        rows = session.execute(
            text(
                f"""
                select * from review_moderation.review_case_queue
                where {predicates[queue]}
                order by sla_overdue desc, first_response_due_at, created_at, review_case_id
                limit :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()
        return ReviewCaseList(items=[_summary(row) for row in rows], queue=queue)


def get_review_case(review_case_id: UUID) -> ReviewCaseDetail:
    with _review_session() as session:
        return _detail(session, review_case_id)


def intake_submission(
    submission_id: UUID,
    command: IntakeReviewCaseCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.intake"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        submission = session.execute(
            text(
                """
                select submission_id, account_id, state::text, latest_revision_number
                from community_intake.submissions
                where submission_id = :submission_id
                for update
                """
            ),
            {"submission_id": submission_id},
        ).mappings().first()
        if submission is None:
            raise HTTPException(status_code=404, detail={"code": "submission_not_found"})
        if submission["account_id"] == actor_id:
            _deny(
                session,
                status_code=403,
                code="review_self_conflict",
                message="Reviewer cannot intake their own submission",
                review_case_id=None,
                submission_id=submission_id,
                actor_account_id=actor_id,
                event_type="review.case.intake_denied",
                idempotency_key=command.idempotency_key,
            )
        if submission["state"] != "submitted" or submission["latest_revision_number"] < 1:
            _deny(
                session,
                status_code=409,
                code="submission_not_reviewable",
                message="Submission has no formal active revision",
                review_case_id=None,
                submission_id=submission_id,
                actor_account_id=actor_id,
                event_type="review.case.intake_denied",
                idempotency_key=command.idempotency_key,
            )
        revision = command.active_revision_number or submission["latest_revision_number"]
        review_case_id = session.execute(
            text(
                """
                insert into review_moderation.review_cases (
                  submission_id, opened_revision_number, active_revision_number,
                  first_response_due_at
                ) values (
                  :submission_id, :revision, :revision,
                  review_moderation.add_business_days(
                    now(), :first_response_business_days
                  )
                ) returning review_case_id
                """
            ),
            {
                "submission_id": submission_id,
                "revision": revision,
                "first_response_business_days": settings.review_first_response_business_days,
            },
        ).scalar_one()
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=submission_id,
            actor_account_id=actor_id,
            event_type="review.case.intake",
            outcome="succeeded",
            reason=None,
            details={"active_revision_number": revision},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def triage_review_case(
    review_case_id: UUID,
    command: TriageReviewCaseCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.triage"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.case.triage_denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        revision = command.active_revision_number or row["active_revision_number"]
        _revision_assertion_keys(session, row["submission_id"], revision)
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set state = 'triage', active_revision_number = :revision,
                    risk_level = :risk_level,
                    duplicate_of_review_case_id = :duplicate_of,
                    first_responded_at = coalesce(first_responded_at, now()),
                    version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {
                "review_case_id": review_case_id,
                "revision": revision,
                "risk_level": command.risk_level,
                "duplicate_of": command.duplicate_of_review_case_id,
            },
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.case.triage",
            outcome="succeeded",
            reason=command.internal_note,
            details={"risk_level": command.risk_level, "active_revision_number": revision},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def claim_review_case(
    review_case_id: UUID,
    command: ClaimReviewCaseCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.claim"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.case.claim_denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        if row["state"] == "closed":
            _deny(
                session,
                status_code=409,
                code="review_case_closed",
                message="Closed ReviewCase cannot be claimed",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.case.claim_denied",
                idempotency_key=command.idempotency_key,
            )
        if row["primary_assignee_id"] not in (None, actor_id):
            _deny(
                session,
                status_code=409,
                code="review_case_already_assigned",
                message="ReviewCase already has a primary assignee",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.case.claim_denied",
                idempotency_key=command.idempotency_key,
            )
        next_state = row["state"] if row["state"] in ("waiting", "decision_ready") else "assigned"
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set primary_assignee_id = :actor_id,
                    state = cast(:next_state as review_moderation.review_case_state),
                    first_responded_at = coalesce(first_responded_at, now()),
                    version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {"actor_id": actor_id, "next_state": next_state, "review_case_id": review_case_id},
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.case.claim",
            outcome="succeeded",
            reason=None,
            details={},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def request_information(
    review_case_id: UUID,
    command: RequestInformationCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.request_information"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.case.request_denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        _check_assignee(session, row, actor_id, command.idempotency_key, "review.case.request_denied")
        request_id = session.execute(
            text(
                """
                insert into review_moderation.information_requests (
                  review_case_id, active_revision_number, requested_fields,
                  user_visible_message, internal_note, requested_by_account_id
                ) values (
                  :review_case_id, :active_revision_number, cast(:fields as jsonb),
                  :visible_message, :internal_note, :actor_id
                ) returning information_request_id
                """
            ),
            {
                "review_case_id": review_case_id,
                "active_revision_number": row["active_revision_number"],
                "fields": json.dumps(command.requested_fields),
                "visible_message": command.user_visible_message,
                "internal_note": command.internal_note,
                "actor_id": actor_id,
            },
        ).scalar_one()
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set state = 'waiting', first_responded_at = coalesce(first_responded_at, now()),
                    version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {"review_case_id": review_case_id},
        )
        _project_status(
            session,
            row=row,
            actor_id=actor_id,
            status="action_required",
            visible_reason=command.user_visible_message,
            action_required_fields=command.requested_fields,
            assertion_results={},
            source_event_id=request_id,
            idempotency_key=f"review-request:{command.idempotency_key}",
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.case.request_information",
            outcome="succeeded",
            reason=command.internal_note,
            details={"requested_fields": command.requested_fields},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def verify_source(
    review_case_id: UUID,
    source_id: UUID,
    command: VerifySourceCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.verify_source"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.source.denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        _check_assignee(session, row, actor_id, command.idempotency_key, "review.source.denied")
        belongs = session.execute(
            text(
                """
                select exists(
                  select 1 from community_intake.submitted_sources
                  where source_id = :source_id and submission_id = :submission_id
                    and revision_number = :active_revision_number
                )
                """
            ),
            {
                "source_id": source_id,
                "submission_id": row["submission_id"],
                "active_revision_number": row["active_revision_number"],
            },
        ).scalar_one()
        if not belongs:
            _deny(
                session,
                status_code=404,
                code="review_source_not_visible",
                message="Source is not part of the active revision",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.source.denied",
                idempotency_key=command.idempotency_key,
            )
        session.execute(
            text(
                """
                insert into review_moderation.source_verifications (
                  review_case_id, source_id, active_revision_number, outcome,
                  normalized_locator, canonical_source_id, reason, verified_by_account_id
                ) values (
                  :review_case_id, :source_id, :active_revision_number,
                  cast(:outcome as review_moderation.source_verification_outcome),
                  :normalized_locator, :canonical_source_id, :reason, :actor_id
                )
                """
            ),
            {
                "review_case_id": review_case_id,
                "source_id": source_id,
                "active_revision_number": row["active_revision_number"],
                "outcome": command.outcome.value,
                "normalized_locator": command.normalized_locator,
                "canonical_source_id": command.canonical_source_id,
                "reason": command.reason,
                "actor_id": actor_id,
            },
        )
        next_state = "decision_ready" if _decision_ready(session, row) and row["state"] != "waiting" else row["state"]
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set state = cast(:next_state as review_moderation.review_case_state),
                    version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {"next_state": next_state, "review_case_id": review_case_id},
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.source.verify",
            outcome="succeeded",
            reason=command.reason,
            details={"source_id": str(source_id), "outcome": command.outcome.value},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def decide_review_case(
    review_case_id: UUID,
    command: DecideReviewCaseCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.decide"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.decision.denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        _check_assignee(session, row, actor_id, command.idempotency_key, "review.decision.denied")
        assertion_keys = _revision_assertion_keys(
            session, row["submission_id"], row["active_revision_number"]
        )
        selected = set(command.selected_assertion_keys)
        if not selected.issubset(assertion_keys):
            _deny(
                session,
                status_code=409,
                code="unknown_selected_assertion",
                message="Decision selected an assertion outside the active revision",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.decision.denied",
                idempotency_key=command.idempotency_key,
            )
        if command.outcome is ReviewDecisionOutcome.ACCEPTED and not _decision_ready(session, row):
            _deny(
                session,
                status_code=409,
                code="review_evidence_not_ready",
                message="Accepted decision requires verified sources and clean attachments",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.decision.denied",
                idempotency_key=command.idempotency_key,
            )
        decision_id = session.execute(
            text(
                """
                insert into review_moderation.decisions (
                  review_case_id, active_revision_number, outcome,
                  user_visible_explanation, internal_reason, selected_assertion_keys,
                  duplicate_of_review_case_id, decided_by_account_id
                ) values (
                  :review_case_id, :active_revision_number,
                  cast(:outcome as review_moderation.review_decision_outcome),
                  :visible_explanation, :internal_reason, cast(:selected as jsonb),
                  :duplicate_of, :actor_id
                ) returning decision_id
                """
            ),
            {
                "review_case_id": review_case_id,
                "active_revision_number": row["active_revision_number"],
                "outcome": command.outcome.value,
                "visible_explanation": command.user_visible_explanation,
                "internal_reason": command.internal_reason,
                "selected": json.dumps(command.selected_assertion_keys),
                "duplicate_of": command.duplicate_of_review_case_id,
                "actor_id": actor_id,
            },
        ).scalar_one()
        accepted = command.outcome is ReviewDecisionOutcome.ACCEPTED
        next_state = "decision_ready" if accepted else "closed"
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set state = cast(:next_state as review_moderation.review_case_state),
                    closed_at = case when :next_state = 'closed' then now() else null end,
                    first_responded_at = coalesce(first_responded_at, now()),
                    version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {"next_state": next_state, "review_case_id": review_case_id},
        )
        visible_status = {
            ReviewDecisionOutcome.ACCEPTED: "accepted",
            ReviewDecisionOutcome.NOT_ACCEPTED: "not_accepted",
            ReviewDecisionOutcome.DUPLICATE: "duplicate",
            ReviewDecisionOutcome.OUT_OF_SCOPE: "out_of_scope",
            ReviewDecisionOutcome.ABUSE: "not_accepted",
        }[command.outcome]
        assertion_results = {
            key: ("selected" if key in selected else "not_selected") for key in assertion_keys
        }
        _project_status(
            session,
            row=row,
            actor_id=actor_id,
            status=visible_status,
            visible_reason=command.user_visible_explanation,
            action_required_fields=[],
            assertion_results=assertion_results,
            source_event_id=decision_id,
            idempotency_key=f"review-decision:{command.idempotency_key}",
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.decision.record",
            outcome="succeeded",
            reason=command.internal_reason,
            details={"outcome": command.outcome.value, "selected": sorted(selected)},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def recommend_assertions(
    review_case_id: UUID,
    command: RecommendAssertionsCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.recommend"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.recommend.denied")
        _check_version(session, row, command.expected_version, actor_id, command.idempotency_key)
        _check_assignee(session, row, actor_id, command.idempotency_key, "review.recommend.denied")
        decision = session.execute(
            text(
                """
                select decision_id, outcome::text, selected_assertion_keys
                from review_moderation.decisions
                where review_case_id = :review_case_id
                order by decided_at desc, decision_id desc
                limit 1
                """
            ),
            {"review_case_id": review_case_id},
        ).mappings().first()
        if decision is None or decision["outcome"] != "accepted":
            _deny(
                session,
                status_code=409,
                code="accepted_decision_required",
                message="Curation recommendation requires an accepted decision",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.recommend.denied",
                idempotency_key=command.idempotency_key,
            )
        selected = list(decision["selected_assertion_keys"] or [])
        for assertion_key in selected:
            session.execute(
                text(
                    """
                    insert into review_moderation.curation_recommendations (
                      review_case_id, decision_id, assertion_key,
                      recommended_by_account_id, reason
                    ) values (
                      :review_case_id, :decision_id, :assertion_key, :actor_id, :reason
                    )
                    """
                ),
                {
                    "review_case_id": review_case_id,
                    "decision_id": decision["decision_id"],
                    "assertion_key": assertion_key,
                    "actor_id": actor_id,
                    "reason": command.reason,
                },
            )
        session.execute(
            text(
                """
                update review_moderation.review_cases
                set state = 'incorporation_recommended', version = version + 1
                where review_case_id = :review_case_id
                """
            ),
            {"review_case_id": review_case_id},
        )
        _audit(
            session,
            review_case_id=review_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.curation.recommend",
            outcome="succeeded",
            reason=command.reason,
            details={"selected": selected},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, review_case_id)
        return _detail(session, review_case_id)


def reopen_review_case(
    review_case_id: UUID,
    command: ReopenReviewCaseCommand,
    actor_id: UUID,
) -> ReviewCaseDetail:
    command_name = "review.case.reopen"
    with _review_session() as session:
        replayed = _replayed_case_id(session, actor_id, command.idempotency_key, command_name)
        if replayed:
            return _detail(session, replayed)
        row = _load_case_row(session, review_case_id, lock=True)
        _check_not_self(session, row, actor_id, command.idempotency_key, "review.reopen.denied")
        if row["state"] != "closed":
            _deny(
                session,
                status_code=409,
                code="closed_review_case_required",
                message="Only a closed ReviewCase can be reopened",
                review_case_id=review_case_id,
                submission_id=row["submission_id"],
                actor_account_id=actor_id,
                event_type="review.reopen.denied",
                idempotency_key=command.idempotency_key,
            )
        latest_revision = session.execute(
            text(
                "select latest_revision_number from community_intake.submissions where submission_id = :submission_id"
            ),
            {"submission_id": row["submission_id"]},
        ).scalar_one()
        new_case_id = session.execute(
            text(
                """
                insert into review_moderation.review_cases (
                  submission_id, opened_revision_number, active_revision_number,
                  reopened_from_review_case_id, first_response_due_at
                ) values (
                  :submission_id, :revision, :revision, :reopened_from,
                  review_moderation.add_business_days(now(), :business_days)
                ) returning review_case_id
                """
            ),
            {
                "submission_id": row["submission_id"],
                "revision": latest_revision,
                "reopened_from": review_case_id,
                "business_days": settings.review_first_response_business_days,
            },
        ).scalar_one()
        _audit(
            session,
            review_case_id=new_case_id,
            submission_id=row["submission_id"],
            actor_account_id=actor_id,
            event_type="review.case.reopen",
            outcome="succeeded",
            reason=command.reason,
            details={"reopened_from_review_case_id": str(review_case_id)},
            idempotency_key=command.idempotency_key,
        )
        _record_receipt(session, actor_id, command.idempotency_key, command_name, new_case_id)
        return _detail(session, new_case_id)


def review_metrics() -> ReviewMetricsRead:
    with _review_session() as session:
        row = session.execute(
            text(
                """
                select
                  count(*) filter (where state <> 'closed') as total_open,
                  count(*) filter (where state = 'new') as new,
                  count(*) filter (where state = 'triage') as triage,
                  count(*) filter (where state = 'assigned') as assigned,
                  count(*) filter (where state = 'waiting') as waiting,
                  count(*) filter (where state = 'decision_ready') as decision_ready,
                  count(*) filter (where state = 'incorporation_recommended') as incorporation_recommended,
                  count(*) filter (where state = 'closed') as closed,
                  count(*) filter (where sla_overdue) as sla_overdue,
                  coalesce(max(queue_age_seconds) filter (where state <> 'closed'), 0) as oldest_open_age_seconds
                from review_moderation.review_case_queue
                """
            )
        ).mappings().one()
        return ReviewMetricsRead(**row)
