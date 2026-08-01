from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.identity.models import RequestIdentity
from app.identity.security import get_request_identity, resolve_correlation_id
from app.review_moderation.sanction_models import (
    AppealCaseRead,
    ModerationNoticeRead,
    OpenAppealCommand,
)
from app.review_moderation.sanction_service import current_notice, open_appeal

router = APIRouter(prefix="/moderation")

Identity = Annotated[RequestIdentity, Depends(get_request_identity)]
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]


@router.get("/notice", response_model=ModerationNoticeRead)
def get_current_moderation_notice(identity: Identity) -> ModerationNoticeRead:
    return current_notice(identity)


@router.post(
    "/appeals",
    response_model=AppealCaseRead,
    status_code=status.HTTP_201_CREATED,
)
def open_moderation_appeal(
    payload: OpenAppealCommand,
    identity: Identity,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return open_appeal(payload, identity, correlation_id)
