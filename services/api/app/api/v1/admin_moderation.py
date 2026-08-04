from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.identity.models import RequestIdentity
from app.identity.security import require_capability, resolve_correlation_id
from app.review_moderation.sanction_models import (
    AcknowledgeAppealCommand,
    AppealCaseList,
    AppealCaseRead,
    AppealState,
    DecideAppealCommand,
    IssueSanctionCommand,
    ModerationMetricsRead,
    ModerationSubjectList,
    ModerationSubjectRead,
    RestoreSanctionCommand,
    TemporarySubmissionFreezeCommand,
)
from app.review_moderation.sanction_service import (
    acknowledge_appeal,
    decide_appeal,
    get_subject,
    issue_sanction,
    issue_temporary_submission_freeze,
    list_appeals,
    list_subjects,
    moderation_metrics,
    restore_sanction,
)

router = APIRouter(prefix="/admin/moderation")
CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]
SanctionReader = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.sanction.read", admin_shell=True)),
]
SanctionIssuer = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "moderation.sanction.apply",
            recent_auth=True,
            admin_shell=True,
        )
    ),
]
TemporaryFreezer = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "moderation.temporary_submission_freeze",
            recent_auth=True,
            admin_shell=True,
        )
    ),
]
SanctionRestorer = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "moderation.sanction.restore",
            recent_auth=True,
            admin_shell=True,
        )
    ),
]
AppealReader = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.appeal.read", admin_shell=True)),
]
AppealDecider = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "moderation.appeal.decide",
            recent_auth=True,
            admin_shell=True,
        )
    ),
]
MetricsReader = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.metrics", admin_shell=True)),
]


@router.get("/accounts", response_model=ModerationSubjectList)
def list_moderation_accounts(
    _: SanctionReader,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ModerationSubjectList:
    return list_subjects(limit)


@router.get("/accounts/{account_id}", response_model=ModerationSubjectRead)
def get_moderation_account(
    account_id: UUID,
    _: SanctionReader,
) -> ModerationSubjectRead:
    return get_subject(account_id)


@router.post(
    "/accounts/{account_id}/sanctions",
    response_model=ModerationSubjectRead,
)
def issue_moderation_sanction(
    account_id: UUID,
    payload: IssueSanctionCommand,
    identity: SanctionIssuer,
    correlation_id: CorrelationId,
) -> ModerationSubjectRead:
    return issue_sanction(account_id, payload, identity, correlation_id)


@router.post(
    "/accounts/{account_id}/temporary-submission-freezes",
    response_model=ModerationSubjectRead,
)
def issue_moderation_temporary_submission_freeze(
    account_id: UUID,
    payload: TemporarySubmissionFreezeCommand,
    identity: TemporaryFreezer,
    correlation_id: CorrelationId,
) -> ModerationSubjectRead:
    return issue_temporary_submission_freeze(
        account_id,
        payload,
        identity,
        correlation_id,
    )


@router.post(
    "/accounts/{account_id}/sanctions/{sanction_id}/restore",
    response_model=ModerationSubjectRead,
)
def restore_moderation_sanction(
    account_id: UUID,
    sanction_id: UUID,
    payload: RestoreSanctionCommand,
    identity: SanctionRestorer,
    correlation_id: CorrelationId,
) -> ModerationSubjectRead:
    return restore_sanction(
        account_id,
        sanction_id,
        payload,
        identity,
        correlation_id,
    )


@router.get("/appeals", response_model=AppealCaseList)
def list_moderation_appeals(
    _: AppealReader,
    state: AppealState | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
) -> AppealCaseList:
    return list_appeals(state, limit)


@router.post(
    "/appeals/{appeal_case_id}/acknowledge",
    response_model=AppealCaseRead,
)
def acknowledge_moderation_appeal(
    appeal_case_id: UUID,
    payload: AcknowledgeAppealCommand,
    identity: AppealDecider,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return acknowledge_appeal(
        appeal_case_id,
        payload,
        identity,
        correlation_id,
    )


@router.post(
    "/appeals/{appeal_case_id}/decide",
    response_model=AppealCaseRead,
)
def decide_moderation_appeal(
    appeal_case_id: UUID,
    payload: DecideAppealCommand,
    identity: AppealDecider,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return decide_appeal(
        appeal_case_id,
        payload,
        identity,
        correlation_id,
    )


@router.get("/metrics", response_model=ModerationMetricsRead)
def get_moderation_metrics(_: MetricsReader) -> ModerationMetricsRead:
    return moderation_metrics()
