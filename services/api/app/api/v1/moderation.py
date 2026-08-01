from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict

from app.identity.models import RequestIdentity
from app.identity.security import get_request_identity, resolve_correlation_id
from app.review_moderation.sanction_models import (
    AppealDecisionOutcome,
    AppealState,
    OpenAppealCommand,
    SanctionKind,
    SanctionScope,
)
from app.review_moderation.sanction_service import current_notice, open_appeal

router = APIRouter(prefix="/moderation")

Identity = Annotated[RequestIdentity, Depends(get_request_identity)]
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


class UserSanctionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    sanction_id: UUID
    kind: SanctionKind
    scope: SanctionScope
    reason_code: str
    user_visible_explanation: str
    starts_at: datetime
    ends_at: datetime | None
    created_at: datetime
    active: bool
    restored_at: datetime | None = None


class UserAppealDecisionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    outcome: AppealDecisionOutcome
    user_visible_explanation: str
    decided_at: datetime


class UserAppealCaseRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    appeal_case_id: UUID
    sanction_id: UUID
    state: AppealState
    version: int
    user_statement: str
    first_response_due_at: datetime
    created_at: datetime
    updated_at: datetime
    decision: UserAppealDecisionRead | None = None


class UserModerationNoticeRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: int
    account_state: str
    submission_restricted: bool
    attachment_restricted: bool
    notification_restricted: bool
    account_suspended: bool
    account_closed_for_abuse: bool
    sanctions: list[UserSanctionRead]
    appeals: list[UserAppealCaseRead]


@router.get("/notice", response_model=UserModerationNoticeRead)
def get_current_moderation_notice(identity: Identity) -> object:
    return current_notice(identity)


@router.post(
    "/appeals",
    response_model=UserAppealCaseRead,
    status_code=status.HTTP_201_CREATED,
)
def open_moderation_appeal(
    payload: OpenAppealCommand,
    identity: Identity,
    correlation_id: CorrelationId,
) -> object:
    return open_appeal(payload, identity, correlation_id)
