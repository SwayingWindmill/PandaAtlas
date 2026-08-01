from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import AccountState
from app.review_moderation.moderation_models import (
    AppealCaseState,
    AppealDecisionOutcome,
    ModerationActionKind,
    MyAppealCaseRead,
    MyAppealQueueRead,
    MyModerationActionRead,
    MyModerationRead,
)


@contextmanager
def _query_session() -> Iterator[Session]:
    if not settings.review_moderation_enabled:
        raise HTTPException(status_code=404, detail={"code": "moderation_disabled"})
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
    with session_scope() as session:
        if session is None:
            raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
        yield session


def get_my_moderation(account_id: UUID) -> MyModerationRead:
    with _query_session() as session:
        account_state = session.execute(
            text(
                """
                select state::text
                from identity.accounts
                where account_id = :account_id
                """
            ),
            {"account_id": account_id},
        ).scalar_one_or_none()
        if account_state is None:
            raise HTTPException(status_code=404, detail={"code": "moderation_account_not_found"})
        rows = session.execute(
            text(
                """
                select
                  action.action_id,
                  action.kind::text as kind,
                  action.scope,
                  action.reason_code,
                  action.user_visible_explanation,
                  action.starts_at,
                  action.ends_at,
                  action.created_at,
                  exists(
                    select 1
                    from review_moderation.effective_sanctions effective
                    where effective.action_id = action.action_id
                  ) as effective,
                  (
                    select appeal.appeal_case_id
                    from review_moderation.appeal_cases appeal
                    where appeal.sanction_action_id = action.action_id
                    order by appeal.created_at desc, appeal.appeal_case_id desc
                    limit 1
                  ) as appeal_case_id
                from review_moderation.moderation_actions action
                where action.account_id = :account_id
                  and action.kind <> 'restoration'
                order by action.created_at desc, action.action_id desc
                """
            ),
            {"account_id": account_id},
        ).mappings().all()
        return MyModerationRead(
            account_state=AccountState(str(account_state)),
            actions=[
                MyModerationActionRead(
                    action_id=row["action_id"],
                    kind=ModerationActionKind(str(row["kind"])),
                    scope=str(row["scope"]),
                    reason_code=str(row["reason_code"]),
                    user_visible_explanation=str(row["user_visible_explanation"]),
                    starts_at=row["starts_at"],
                    ends_at=row["ends_at"],
                    created_at=row["created_at"],
                    effective=bool(row["effective"]),
                    appeal_case_id=row["appeal_case_id"],
                )
                for row in rows
            ],
        )


def _my_appeal_from_row(row: dict[str, object]) -> MyAppealCaseRead:
    return MyAppealCaseRead(
        appeal_case_id=row["appeal_case_id"],
        sanction_action_id=row["sanction_action_id"],
        state=AppealCaseState(str(row["state"])),
        version=row["version"],
        appellant_message=str(row["appellant_message"]),
        first_response_due_at=row["first_response_due_at"],
        first_responded_at=row["first_responded_at"],
        outcome=AppealDecisionOutcome(str(row["outcome"])) if row["outcome"] else None,
        user_visible_resolution=row["user_visible_resolution"],
        closed_at=row["closed_at"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        sanction_kind=ModerationActionKind(str(row["sanction_kind"])),
        sanction_scope=str(row["sanction_scope"]),
        sanction_user_visible_explanation=str(row["sanction_user_visible_explanation"]),
    )


def list_my_appeals(account_id: UUID) -> MyAppealQueueRead:
    with _query_session() as session:
        rows = session.execute(
            text(
                """
                select *
                from review_moderation.appeal_queue
                where account_id = :account_id
                order by created_at desc, appeal_case_id desc
                """
            ),
            {"account_id": account_id},
        ).mappings().all()
        return MyAppealQueueRead(items=[_my_appeal_from_row(dict(row)) for row in rows])


def get_my_appeal(account_id: UUID, appeal_case_id: UUID) -> MyAppealCaseRead:
    with _query_session() as session:
        row = session.execute(
            text(
                """
                select *
                from review_moderation.appeal_queue
                where account_id = :account_id
                  and appeal_case_id = :appeal_case_id
                """
            ),
            {"account_id": account_id, "appeal_case_id": appeal_case_id},
        ).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "appeal_case_not_found"})
        return _my_appeal_from_row(dict(row))
