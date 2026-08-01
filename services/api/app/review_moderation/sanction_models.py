from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SanctionKind(StrEnum):
    WARNING = "warning"
    SUBMISSION_RESTRICTED = "submission_restricted"
    ATTACHMENT_RESTRICTED = "attachment_restricted"
    NOTIFICATION_RESTRICTED = "notification_restricted"
    ACCOUNT_SUSPENDED = "account_suspended"
    ACCOUNT_CLOSED_FOR_ABUSE = "account_closed_for_abuse"


class SanctionScope(StrEnum):
    ACCOUNT = "account"
    SUBMISSION = "submission"
    ATTACHMENT = "attachment"
    NOTIFICATION = "notification"


_KIND_SCOPE: dict[SanctionKind, SanctionScope] = {
    SanctionKind.WARNING: SanctionScope.ACCOUNT,
    SanctionKind.SUBMISSION_RESTRICTED: SanctionScope.SUBMISSION,
    SanctionKind.ATTACHMENT_RESTRICTED: SanctionScope.ATTACHMENT,
    SanctionKind.NOTIFICATION_RESTRICTED: SanctionScope.NOTIFICATION,
    SanctionKind.ACCOUNT_SUSPENDED: SanctionScope.ACCOUNT,
    SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE: SanctionScope.ACCOUNT,
}


class AppealState(StrEnum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    CLOSED = "closed"


class AppealDecisionOutcome(StrEnum):
    UPHELD = "upheld"
    OVERTURNED = "overturned"
    DISMISSED = "dismissed"


class ModerationCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    expected_version: int = Field(ge=1)


class IssueSanctionCommand(ModerationCommand):
    kind: SanctionKind
    scope: SanctionScope
    reason_code: str = Field(pattern=r"^[a-z][a-z0-9_.-]{2,63}$")
    internal_explanation: str = Field(min_length=10, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)
    starts_at: datetime
    ends_at: datetime | None

    @model_validator(mode="after")
    def validate_scope_and_window(self) -> IssueSanctionCommand:
        if _KIND_SCOPE[self.kind] is not self.scope:
            raise ValueError("scope does not match sanction kind")
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        if self.kind is SanctionKind.ACCOUNT_CLOSED_FOR_ABUSE and self.ends_at is not None:
            raise ValueError("account_closed_for_abuse must not have ends_at")
        return self


class TemporarySubmissionFreezeCommand(ModerationCommand):
    scope: Literal[SanctionScope.SUBMISSION] = SanctionScope.SUBMISSION
    reason_code: str = Field(pattern=r"^[a-z][a-z0-9_.-]{2,63}$")
    internal_explanation: str = Field(min_length=10, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_window(self) -> TemporarySubmissionFreezeCommand:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self

    def as_sanction(self) -> IssueSanctionCommand:
        return IssueSanctionCommand(
            idempotency_key=self.idempotency_key,
            expected_version=self.expected_version,
            kind=SanctionKind.SUBMISSION_RESTRICTED,
            scope=SanctionScope.SUBMISSION,
            reason_code=self.reason_code,
            internal_explanation=self.internal_explanation,
            user_visible_explanation=self.user_visible_explanation,
            starts_at=self.starts_at,
            ends_at=self.ends_at,
        )


class RestoreSanctionCommand(ModerationCommand):
    reason_code: str = Field(pattern=r"^[a-z][a-z0-9_.-]{2,63}$")
    internal_explanation: str = Field(min_length=10, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)


class OpenAppealCommand(ModerationCommand):
    sanction_id: UUID
    user_statement: str = Field(min_length=20, max_length=4000)


class AcknowledgeAppealCommand(ModerationCommand):
    internal_note: str = Field(min_length=10, max_length=4000)


class DecideAppealCommand(ModerationCommand):
    outcome: AppealDecisionOutcome
    expected_subject_version: int | None = Field(default=None, ge=1)
    internal_explanation: str = Field(min_length=10, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)

    @model_validator(mode="after")
    def require_subject_version_for_overturn(self) -> DecideAppealCommand:
        if (
            self.outcome is AppealDecisionOutcome.OVERTURNED
            and self.expected_subject_version is None
        ):
            raise ValueError("expected_subject_version is required when appeal is overturned")
        return self


class SanctionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    sanction_id: UUID
    account_id: UUID
    kind: SanctionKind
    scope: SanctionScope
    reason_code: str
    internal_explanation: str | None = None
    user_visible_explanation: str
    starts_at: datetime
    ends_at: datetime | None
    issued_by_account_id: UUID
    subject_version_before: int
    subject_version_after: int
    created_at: datetime
    active: bool
    appealable: bool
    restored_at: datetime | None = None


class RestorationRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    restoration_id: UUID
    sanction_id: UUID
    account_id: UUID
    reason_code: str
    internal_explanation: str | None = None
    user_visible_explanation: str
    restored_by_account_id: UUID
    subject_version_before: int
    subject_version_after: int
    restored_at: datetime


class AppealDecisionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    decision_id: UUID
    appeal_case_id: UUID
    outcome: AppealDecisionOutcome
    internal_explanation: str | None = None
    user_visible_explanation: str
    decided_by_account_id: UUID
    decided_at: datetime


class AppealCaseRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    appeal_case_id: UUID
    account_id: UUID
    sanction_id: UUID
    state: AppealState
    version: int
    user_statement: str
    first_response_due_at: datetime
    first_responded_at: datetime | None = None
    sla_overdue: bool
    age_seconds: int
    created_at: datetime
    updated_at: datetime
    decision: AppealDecisionRead | None = None


class ModerationSubjectRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    account_id: UUID
    version: int
    account_state: str
    submission_restricted: bool
    attachment_restricted: bool
    notification_restricted: bool
    account_suspended: bool
    account_closed_for_abuse: bool
    submission_restricted_until: datetime | None = None
    attachment_restricted_until: datetime | None = None
    notification_restricted_until: datetime | None = None
    account_restricted_until: datetime | None = None
    repeat_abuse_count: int
    inconsistent_account_state: bool
    sanctions: list[SanctionRead] = Field(default_factory=list)
    appeals: list[AppealCaseRead] = Field(default_factory=list)


class ModerationSubjectList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[ModerationSubjectRead]


class AppealCaseList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[AppealCaseRead]


class ModerationNoticeRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: int
    account_state: str
    submission_restricted: bool
    attachment_restricted: bool
    notification_restricted: bool
    account_suspended: bool
    account_closed_for_abuse: bool
    sanctions: list[SanctionRead]
    appeals: list[AppealCaseRead]


class ModerationMetricsRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    active_sanctions: int
    oldest_active_sanction_age_seconds: int
    active_submission_restrictions: int
    active_attachment_restrictions: int
    active_notification_restrictions: int
    suspended_accounts: int
    open_appeals: int
    appeal_sla_overdue: int
    oldest_appeal_age_seconds: int
    repeat_abuse_accounts: int
    expired_restriction_projected: int
    restorations_last_24h: int
    unauthorized_attempts_last_24h: int
    inconsistent_account_state: int
    alerts: list[str]
