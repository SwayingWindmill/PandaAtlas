from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ModerationActionKind(StrEnum):
    WARNING = "warning"
    SUBMISSION_RESTRICTED = "submission_restricted"
    ATTACHMENT_RESTRICTED = "attachment_restricted"
    NOTIFICATION_RESTRICTED = "notification_restricted"
    ACCOUNT_SUSPENDED = "account_suspended"
    ACCOUNT_CLOSED_FOR_ABUSE = "account_closed_for_abuse"
    RESTORATION = "restoration"


class AppealCaseState(StrEnum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    CLOSED = "closed"


class AppealDecisionOutcome(StrEnum):
    UPHELD = "upheld"
    MODIFIED = "modified"
    OVERTURNED = "overturned"


class ModerationCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)


class VersionedModerationCommand(ModerationCommand):
    expected_version: int = Field(ge=1)


class IssueModerationActionCommand(VersionedModerationCommand):
    kind: ModerationActionKind
    scope: str = Field(min_length=2, max_length=128, pattern=r"^[a-z][a-z0-9_.:-]+$")
    reason_code: str = Field(
        min_length=2,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_.:-]+$",
    )
    internal_explanation: str = Field(min_length=3, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)
    starts_at: datetime
    ends_at: datetime | None = None

    @model_validator(mode="after")
    def validate_action(self) -> IssueModerationActionCommand:
        if self.kind is ModerationActionKind.RESTORATION:
            raise ValueError("restoration uses the dedicated restore command")
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class RestoreModerationActionCommand(VersionedModerationCommand):
    reason_code: str = Field(
        min_length=2,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_.:-]+$",
    )
    internal_explanation: str = Field(min_length=3, max_length=4000)
    user_visible_explanation: str = Field(min_length=10, max_length=2000)


class SubmitAppealCommand(ModerationCommand):
    sanction_action_id: UUID
    appellant_message: str = Field(min_length=10, max_length=4000)


class ClaimAppealCommand(VersionedModerationCommand):
    pass


class DecideAppealCommand(VersionedModerationCommand):
    outcome: AppealDecisionOutcome
    reason_code: str = Field(
        min_length=2,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_.:-]+$",
    )
    internal_resolution: str = Field(min_length=3, max_length=4000)
    user_visible_resolution: str = Field(min_length=10, max_length=2000)
    replacement_kind: ModerationActionKind | None = None
    replacement_scope: str | None = Field(
        default=None,
        min_length=2,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_.:-]+$",
    )
    replacement_starts_at: datetime | None = None
    replacement_ends_at: datetime | None = None

    @model_validator(mode="after")
    def validate_resolution(self) -> DecideAppealCommand:
        replacement_fields = (
            self.replacement_kind,
            self.replacement_scope,
            self.replacement_starts_at,
        )
        if self.outcome is AppealDecisionOutcome.MODIFIED:
            if any(value is None for value in replacement_fields):
                raise ValueError("modified appeals require a replacement sanction")
            if self.replacement_kind is ModerationActionKind.RESTORATION:
                raise ValueError("replacement sanction cannot be restoration")
            if (
                self.replacement_ends_at is not None
                and self.replacement_starts_at is not None
                and self.replacement_ends_at <= self.replacement_starts_at
            ):
                raise ValueError("replacement_ends_at must follow replacement_starts_at")
        elif any(value is not None for value in (*replacement_fields, self.replacement_ends_at)):
            raise ValueError("replacement sanction is valid only for modified appeals")
        return self


class ModerationActionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    action_id: UUID
    account_id: UUID
    kind: ModerationActionKind
    scope: str
    reason_code: str
    internal_explanation: str
    user_visible_explanation: str
    starts_at: datetime
    ends_at: datetime | None = None
    actor_account_id: UUID
    expected_version: int
    resulting_version: int
    supersedes_action_id: UUID | None = None
    correlation_id: UUID
    created_at: datetime
    effective: bool


class AccountModerationRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    account_id: UUID
    version: int
    account_state: Literal["active", "suspended", "deleting", "deleted"]
    actions: list[ModerationActionRead]


class MyModerationActionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    action_id: UUID
    kind: ModerationActionKind
    scope: str
    reason_code: str
    user_visible_explanation: str
    starts_at: datetime
    ends_at: datetime | None = None
    created_at: datetime
    effective: bool
    appeal_case_id: UUID | None = None


class MyModerationRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    account_state: Literal["active", "suspended", "deleting", "deleted"]
    actions: list[MyModerationActionRead]


class AppealCaseRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    appeal_case_id: UUID
    account_id: UUID
    sanction_action_id: UUID
    state: AppealCaseState
    version: int
    appellant_message: str
    primary_assignee_id: UUID | None = None
    first_response_due_at: datetime
    first_responded_at: datetime | None = None
    outcome: AppealDecisionOutcome | None = None
    user_visible_resolution: str | None = None
    internal_resolution: str | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    sanction_kind: ModerationActionKind
    sanction_scope: str
    sanction_user_visible_explanation: str
    sla_overdue: bool
    queue_age_seconds: int


class AppealQueueRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[AppealCaseRead]
    state: AppealCaseState | Literal["all"]


class MyAppealCaseRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    appeal_case_id: UUID
    sanction_action_id: UUID
    state: AppealCaseState
    version: int
    appellant_message: str
    first_response_due_at: datetime
    first_responded_at: datetime | None = None
    outcome: AppealDecisionOutcome | None = None
    user_visible_resolution: str | None = None
    closed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    sanction_kind: ModerationActionKind
    sanction_scope: str
    sanction_user_visible_explanation: str


class MyAppealQueueRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[MyAppealCaseRead]


class ModerationMetricsRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    active_sanctions: int
    suspended_accounts: int
    open_appeals: int
    overdue_appeals: int
    oldest_open_appeal_age_seconds: int


class ModerationDenial(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: str
    message: str
