from typing import Annotated, Literal, Never
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import DBAPIError

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
    ModerationActionKind,
    ModerationMetricsRead,
    MyAppealCaseRead,
    MyAppealQueueRead,
    MyModerationActionRead,
    MyModerationRead,
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
    Depends(require_capability("moderation.sanction.issue", recent_auth=True)),
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

_OWNERSHIP_CONFLICT_MESSAGES = (
    "moderation-owned suspension requires an append-only restoration action",
    "moderation cannot restore an account suspended by another process",
)


def _raise_moderation_database_error(error: DBAPIError) -> Never:
    original = error.orig
    sqlstate = getattr(original, "sqlstate", None)
    description = str(original).lower()
    if sqlstate == "40001" and any(
        message in description for message in _OWNERSHIP_CONFLICT_MESSAGES
    ):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "moderation_account_state_ownership_conflict",
                "message": (
                    "The account suspension is owned or has been superseded by another process. "
                    "Moderation history was preserved and the account remains suspended."
                ),
            },
        ) from error
    raise error


def _user_safe_appeal(appeal: AppealCaseRead) -> MyAppealCaseRead:
    return MyAppealCaseRead(
        appeal_case_id=appeal.appeal_case_id,
        sanction_action_id=appeal.sanction_action_id,
        state=appeal.state,
        version=appeal.version,
        appellant_message=appeal.appellant_message,
        first_response_due_at=appeal.first_response_due_at,
        first_responded_at=appeal.first_responded_at,
        outcome=appeal.outcome,
        user_visible_resolution=appeal.user_visible_resolution,
        closed_at=appeal.closed_at,
        created_at=appeal.created_at,
        updated_at=appeal.updated_at,
        sanction_kind=appeal.sanction_kind,
        sanction_scope=appeal.sanction_scope,
        sanction_user_visible_explanation=appeal.sanction_user_visible_explanation,
    )


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
    try:
        return restore_moderation_action(action_id, command, identity, correlation_id)
    except DBAPIError as error:
        _raise_moderation_database_error(error)


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
    try:
        return decide_appeal(appeal_case_id, command, identity, correlation_id)
    except DBAPIError as error:
        _raise_moderation_database_error(error)


@admin_router.get("/metrics", response_model=ModerationMetricsRead)
def moderation_metrics_endpoint(identity: ModerationMetricsReader) -> ModerationMetricsRead:
    _ = identity
    return moderation_metrics()


@router.get("/actions", response_model=MyModerationRead)
def get_own_moderation_actions(identity: AppealSubmitter) -> MyModerationRead:
    moderation = get_account_moderation(identity.account_id)
    appeals = [
        appeal
        for appeal in list_appeals("all", 100).items
        if appeal.account_id == identity.account_id
    ]
    appeal_by_action = {appeal.sanction_action_id: appeal.appeal_case_id for appeal in appeals}
    return MyModerationRead(
        account_state=moderation.account_state,
        actions=[
            MyModerationActionRead(
                action_id=action.action_id,
                kind=action.kind,
                scope=action.scope,
                reason_code=action.reason_code,
                user_visible_explanation=action.user_visible_explanation,
                starts_at=action.starts_at,
                ends_at=action.ends_at,
                created_at=action.created_at,
                effective=action.effective,
                appeal_case_id=appeal_by_action.get(action.action_id),
            )
            for action in moderation.actions
            if action.kind is not ModerationActionKind.RESTORATION
        ],
    )


@router.get("/appeals", response_model=MyAppealQueueRead)
def list_own_appeals(identity: AppealSubmitter) -> MyAppealQueueRead:
    return MyAppealQueueRead(
        items=[
            _user_safe_appeal(appeal)
            for appeal in list_appeals("all", 100).items
            if appeal.account_id == identity.account_id
        ]
    )


@router.post("/appeals", response_model=MyAppealCaseRead, status_code=status.HTTP_201_CREATED)
def submit_appeal_endpoint(
    command: SubmitAppealCommand,
    identity: AppealSubmitter,
    correlation_id: CorrelationId,
) -> MyAppealCaseRead:
    return _user_safe_appeal(submit_appeal(command, identity, correlation_id))


@router.get("/appeals/{appeal_case_id}", response_model=MyAppealCaseRead)
def get_own_appeal_endpoint(
    appeal_case_id: UUID,
    identity: AppealSubmitter,
) -> MyAppealCaseRead:
    return _user_safe_appeal(get_appeal(appeal_case_id, account_id=identity.account_id))
