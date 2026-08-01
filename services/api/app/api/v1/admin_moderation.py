from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.identity.models import RequestIdentity
from app.identity.security import get_request_identity, require_capability, resolve_correlation_id
from app.review_moderation.moderation_models import (
    AccountModerationRead,
    AppealCaseRead,
    AppealCaseState,
    AppealQueueRead,
    ClaimAppealCommand,
    DecideAppealCommand,
    IssueModerationActionCommand,
    ModerationMetricsRead,
    RestoreModerationActionCommand,
    SubmitAppealCommand,
)
from app.review_moderation.moderation_service import (
    claim_appeal,
    decide_appeal,
    get_account_moderation,
    get_appeal,
    issue_moderation_action,
    list_appeals,
    moderation_metrics,
    restore_moderation_action,
    submit_appeal,
)

router = APIRouter(prefix="/moderation")
admin_router = APIRouter(prefix="/admin/moderation")

CorrelationId = Annotated[UUID, Depends(resolve_correlation_id)]
ModerationReader = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.case.read")),
]
SanctionIssuer = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.sanction.issue")),
]
SanctionManager = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.sanction.manage", recent_auth=True)),
]
AppealDecider = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.appeal.decide")),
]
RecentlyAuthenticatedAppealDecider = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.appeal.decide", recent_auth=True)),
]
ModerationMetricsReader = Annotated[
    RequestIdentity,
    Depends(require_capability("moderation.metrics")),
]
AppealSubmitter = Annotated[RequestIdentity, Depends(get_request_identity)]
AppealStateParameter = Annotated[
    AppealCaseState | Literal["all"],
    Query(),
]
AppealLimitParameter = Annotated[int, Query(ge=1, le=100)]


@admin_router.get("/accounts/{account_id}", response_model=AccountModerationRead)
def get_account_moderation_endpoint(
    account_id: UUID,
    identity: ModerationReader,
) -> AccountModerationRead:
    _ = identity
    return get_account_moderation(account_id)


@admin_router.post("/accounts/{account_id}/actions", response_model=AccountModerationRead)
def issue_moderation_action_endpoint(
    account_id: UUID,
    command: IssueModerationActionCommand,
    identity: SanctionIssuer,
    correlation_id: CorrelationId,
) -> AccountModerationRead:
    return issue_moderation_action(account_id, command, identity, correlation_id)


@admin_router.post("/actions/{action_id}/restore", response_model=AccountModerationRead)
def restore_moderation_action_endpoint(
    action_id: UUID,
    command: RestoreModerationActionCommand,
    identity: SanctionManager,
    correlation_id: CorrelationId,
) -> AccountModerationRead:
    return restore_moderation_action(action_id, command, identity, correlation_id)


@admin_router.get("/appeals", response_model=AppealQueueRead)
def list_appeals_endpoint(
    identity: ModerationReader,
    state: AppealStateParameter = "all",
    limit: AppealLimitParameter = 100,
) -> AppealQueueRead:
    _ = identity
    return list_appeals(state, limit)


@admin_router.get("/appeals/{appeal_case_id}", response_model=AppealCaseRead)
def get_appeal_endpoint(
    appeal_case_id: UUID,
    identity: ModerationReader,
) -> AppealCaseRead:
    _ = identity
    return get_appeal(appeal_case_id)


@admin_router.post("/appeals/{appeal_case_id}/claim", response_model=AppealCaseRead)
def claim_appeal_endpoint(
    appeal_case_id: UUID,
    command: ClaimAppealCommand,
    identity: AppealDecider,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return claim_appeal(appeal_case_id, command, identity, correlation_id)


@admin_router.post("/appeals/{appeal_case_id}/decide", response_model=AppealCaseRead)
def decide_appeal_endpoint(
    appeal_case_id: UUID,
    command: DecideAppealCommand,
    identity: RecentlyAuthenticatedAppealDecider,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return decide_appeal(appeal_case_id, command, identity, correlation_id)


@admin_router.get("/metrics", response_model=ModerationMetricsRead)
def moderation_metrics_endpoint(identity: ModerationMetricsReader) -> ModerationMetricsRead:
    _ = identity
    return moderation_metrics()


@router.post("/appeals", response_model=AppealCaseRead, status_code=status.HTTP_201_CREATED)
def submit_appeal_endpoint(
    command: SubmitAppealCommand,
    identity: AppealSubmitter,
    correlation_id: CorrelationId,
) -> AppealCaseRead:
    return submit_appeal(command, identity, correlation_id)


@router.get("/appeals/{appeal_case_id}", response_model=AppealCaseRead)
def get_own_appeal_endpoint(
    appeal_case_id: UUID,
    identity: AppealSubmitter,
) -> AppealCaseRead:
    return get_appeal(appeal_case_id, account_id=identity.account_id)
