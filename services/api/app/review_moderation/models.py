from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ReviewCaseState(StrEnum):
    NEW = "new"
    TRIAGE = "triage"
    ASSIGNED = "assigned"
    WAITING = "waiting"
    DECISION_READY = "decision_ready"
    INCORPORATION_RECOMMENDED = "incorporation_recommended"
    CLOSED = "closed"


class ReviewQueue(StrEnum):
    ALL = "all"
    NEW = "new"
    TRIAGE = "triage"
    ASSIGNED = "assigned"
    WAITING = "waiting"
    DECISION_READY = "decision_ready"
    INCORPORATION_RECOMMENDED = "incorporation_recommended"
    CLOSED = "closed"
    SLA_OVERDUE = "sla_overdue"


class ReviewDecisionOutcome(StrEnum):
    ACCEPTED = "accepted"
    NOT_ACCEPTED = "not_accepted"
    DUPLICATE = "duplicate"
    OUT_OF_SCOPE = "out_of_scope"
    ABUSE = "abuse"


class SourceVerificationOutcome(StrEnum):
    VERIFIED = "verified"
    REJECTED = "rejected"


class CommandBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)


class VersionedCommand(CommandBase):
    expected_version: int = Field(ge=1)


class IntakeReviewCaseCommand(CommandBase):
    active_revision_number: int | None = Field(default=None, ge=1)


class TriageReviewCaseCommand(VersionedCommand):
    risk_level: Literal["normal", "elevated", "high"] = "normal"
    active_revision_number: int | None = Field(default=None, ge=1)
    duplicate_of_review_case_id: UUID | None = None
    internal_note: str | None = Field(default=None, min_length=3, max_length=4000)


class ClaimReviewCaseCommand(VersionedCommand):
    pass


class RequestInformationCommand(VersionedCommand):
    requested_fields: list[str] = Field(min_length=1, max_length=25)
    user_visible_message: str = Field(min_length=10, max_length=2000)
    internal_note: str | None = Field(default=None, min_length=3, max_length=4000)

    @field_validator("requested_fields")
    @classmethod
    def normalize_requested_fields(cls, values: list[str]) -> list[str]:
        normalized = [" ".join(value.strip().split()) for value in values]
        if any(not value for value in normalized):
            raise ValueError("requested fields must not be blank")
        if len(set(normalized)) != len(normalized):
            raise ValueError("requested fields must be unique")
        return normalized


class VerifySourceCommand(VersionedCommand):
    outcome: SourceVerificationOutcome
    normalized_locator: str | None = Field(default=None, min_length=3, max_length=2000)
    canonical_source_id: str | None = Field(default=None, min_length=1, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def require_normalized_locator_for_verified(self) -> VerifySourceCommand:
        if self.outcome is SourceVerificationOutcome.VERIFIED and not self.normalized_locator:
            raise ValueError("verified sources require a normalized locator")
        return self


class DecideReviewCaseCommand(VersionedCommand):
    outcome: ReviewDecisionOutcome
    user_visible_explanation: str = Field(min_length=10, max_length=2000)
    internal_reason: str | None = Field(default=None, min_length=3, max_length=4000)
    selected_assertion_keys: list[str] = Field(default_factory=list, max_length=25)
    duplicate_of_review_case_id: UUID | None = None

    @field_validator("selected_assertion_keys")
    @classmethod
    def validate_assertion_keys(cls, values: list[str]) -> list[str]:
        if len(set(values)) != len(values):
            raise ValueError("selected assertion keys must be unique")
        for value in values:
            if not value or len(value) > 128:
                raise ValueError("invalid selected assertion key")
        return values

    @model_validator(mode="after")
    def validate_outcome_payload(self) -> DecideReviewCaseCommand:
        if self.outcome is ReviewDecisionOutcome.ACCEPTED and not self.selected_assertion_keys:
            raise ValueError("accepted decisions require selected assertion keys")
        if self.outcome is ReviewDecisionOutcome.DUPLICATE and not self.duplicate_of_review_case_id:
            raise ValueError("duplicate decisions require a duplicate ReviewCase")
        if self.outcome is not ReviewDecisionOutcome.DUPLICATE and self.duplicate_of_review_case_id:
            raise ValueError("duplicate ReviewCase is only valid for duplicate decisions")
        return self


class RecommendAssertionsCommand(VersionedCommand):
    reason: str = Field(min_length=3, max_length=2000)


class ReopenReviewCaseCommand(CommandBase):
    reason: str = Field(min_length=3, max_length=2000)


class ReviewSourceRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_id: UUID
    source_kind: str
    title: str
    locator: str
    publisher: str | None = None
    published_on: str | None = None
    verification_outcome: SourceVerificationOutcome | None = None
    normalized_locator: str | None = None
    canonical_source_id: str | None = None
    verification_reason: str | None = None


class ReviewAttachmentRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    attachment_id: UUID
    original_filename: str
    media_type: str
    byte_size: int
    state: str
    clean_accessible: bool


class ReviewDecisionRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    decision_id: UUID
    active_revision_number: int
    outcome: ReviewDecisionOutcome
    user_visible_explanation: str
    internal_reason: str | None = None
    selected_assertion_keys: list[str]
    duplicate_of_review_case_id: UUID | None = None
    decided_by_account_id: UUID
    decided_at: datetime


class ReviewInformationRequestRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    information_request_id: UUID
    active_revision_number: int
    requested_fields: list[str]
    user_visible_message: str
    internal_note: str | None = None
    requested_by_account_id: UUID
    created_at: datetime


class ReviewCaseSummary(BaseModel):
    model_config = ConfigDict(frozen=True)

    review_case_id: UUID
    submission_id: UUID
    target_type: str
    target_id: str
    state: ReviewCaseState
    version: int
    opened_revision_number: int
    active_revision_number: int
    primary_assignee_id: UUID | None = None
    risk_level: Literal["normal", "elevated", "high"]
    duplicate_of_review_case_id: UUID | None = None
    reopened_from_review_case_id: UUID | None = None
    contributor_status: str
    first_response_due_at: datetime
    first_responded_at: datetime | None = None
    sla_overdue: bool
    queue_age_seconds: int
    created_at: datetime
    updated_at: datetime


class ReviewCaseDetail(ReviewCaseSummary):
    contributor_account_id: UUID | None = None
    sources: list[ReviewSourceRead]
    attachments: list[ReviewAttachmentRead]
    decisions: list[ReviewDecisionRead]
    information_requests: list[ReviewInformationRequestRead]


class ReviewCaseList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[ReviewCaseSummary]
    queue: ReviewQueue


class ReviewMetricsRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_open: int
    new: int
    triage: int
    assigned: int
    waiting: int
    decision_ready: int
    incorporation_recommended: int
    closed: int
    sla_overdue: int
    oldest_open_age_seconds: int
