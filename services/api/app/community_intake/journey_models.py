from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.community_intake.models import (
    AttachmentView,
    SourceKind,
    SubmissionRevisionView,
    SubmissionState,
    SubmissionTargetType,
    SubmissionType,
    SubmittedSourceInput,
)


class StructuredClaimKind(StrEnum):
    IDENTITY_NAME = "identity_name"
    VITAL_EVENT = "vital_event"
    HEALTH = "health"
    RELATIONSHIP = "relationship"
    RESIDENCY_TRANSFER = "residency_transfer"
    INSTITUTION = "institution"
    SOURCE = "source"
    OTHER = "other"


class ContributorStatus(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACTION_REQUIRED = "action_required"
    DUPLICATE = "duplicate"
    OUT_OF_SCOPE = "out_of_scope"
    NOT_ACCEPTED = "not_accepted"
    ACCEPTED = "accepted"
    INCORPORATION_IN_PROGRESS = "incorporation_in_progress"
    INCORPORATED_FULL = "incorporated_full"
    INCORPORATED_PARTIAL = "incorporated_partial"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"
    TARGET_MERGED = "target_merged"
    TARGET_UNPUBLISHED = "target_unpublished"


class AssertionDisposition(StrEnum):
    PENDING = "pending"
    SELECTED = "selected"
    NOT_SELECTED = "not_selected"
    INCORPORATED = "incorporated"
    NOT_INCORPORATED = "not_incorporated"
    SUPERSEDED = "superseded"


class DraftStructuredAssertionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    assertion_key: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$")
    kind: StructuredClaimKind
    field_path: str = Field(default="", max_length=255)
    proposed_value: Any | None = None
    explanation: str = Field(default="", max_length=2000)
    source_locators: list[str] = Field(default_factory=list, max_length=25)
    attachment_ids: list[UUID] = Field(default_factory=list, max_length=5)

    @field_validator("field_path", "explanation")
    @classmethod
    def strip_optional_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_locators")
    @classmethod
    def normalize_optional_locators(cls, values: list[str]) -> list[str]:
        normalized = [" ".join(value.strip().split()) for value in values if value.strip()]
        if len({value.lower() for value in normalized}) != len(normalized):
            raise ValueError("draft source locators must be unique")
        return normalized


class DraftSubmittedSourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source_kind: SourceKind
    title: str = Field(default="", max_length=500)
    locator: str = Field(default="", max_length=2000)
    publisher: str | None = Field(default=None, max_length=500)
    published_on: date | None = None

    @field_validator("title", "locator")
    @classmethod
    def strip_draft_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("publisher")
    @classmethod
    def strip_optional_publisher(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class StructuredAssertionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    assertion_key: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$")
    kind: StructuredClaimKind
    field_path: str = Field(min_length=1, max_length=255)
    proposed_value: Any
    explanation: str = Field(min_length=10, max_length=2000)
    source_locators: list[str] = Field(default_factory=list, max_length=25)
    attachment_ids: list[UUID] = Field(default_factory=list, max_length=5)

    @field_validator("field_path", "explanation")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("source_locators")
    @classmethod
    def normalize_source_locators(cls, values: list[str]) -> list[str]:
        normalized = [" ".join(value.strip().split()) for value in values]
        if any(not value for value in normalized):
            raise ValueError("source locator must not be blank")
        if len({value.lower() for value in normalized}) != len(normalized):
            raise ValueError("assertion source locators must be unique")
        return normalized

    @model_validator(mode="after")
    def require_evidence_reference(self) -> StructuredAssertionInput:
        if self.proposed_value is None or (
            isinstance(self.proposed_value, str) and not self.proposed_value.strip()
        ):
            raise ValueError("formal assertion proposed value must not be empty")
        if not self.source_locators and not self.attachment_ids:
            raise ValueError("each assertion requires a source or attachment reference")
        if len(set(self.attachment_ids)) != len(self.attachment_ids):
            raise ValueError("assertion attachment references must be unique")
        return self


class ContributorCreateDraftCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    submission_type: SubmissionType
    target_type: SubmissionTargetType = SubmissionTargetType.PANDA
    target_id: str = Field(min_length=1, max_length=255)
    public_version_seen: str = Field(min_length=1, max_length=255)
    locale: Literal["zh", "en"]
    draft_content: dict[str, Any] = Field(default_factory=dict)


class ContributorUpdateDraftCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    expected_version: int = Field(ge=1)
    locale: Literal["zh", "en"]
    public_version_seen: str = Field(min_length=1, max_length=255)
    assertions: list[DraftStructuredAssertionInput] = Field(default_factory=list, max_length=25)
    sources: list[DraftSubmittedSourceInput] = Field(default_factory=list, max_length=25)
    additional_context: str | None = Field(default=None, max_length=4000)


class ContributorSubmitCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    expected_version: int = Field(ge=1)
    locale: Literal["zh", "en"]
    public_version_seen: str = Field(min_length=1, max_length=255)
    assertions: list[StructuredAssertionInput] = Field(min_length=1, max_length=25)
    sources: list[SubmittedSourceInput] = Field(default_factory=list, max_length=25)
    additional_context: str | None = Field(default=None, max_length=4000)
    confirmation: Literal[True]

    @model_validator(mode="after")
    def validate_assertion_keys_and_sources(self) -> ContributorSubmitCommand:
        keys = [assertion.assertion_key for assertion in self.assertions]
        if len(set(keys)) != len(keys):
            raise ValueError("assertion keys must be unique")
        source_locators = {
            " ".join(source.locator.strip().lower().split()) for source in self.sources
        }
        referenced = {
            " ".join(locator.strip().lower().split())
            for assertion in self.assertions
            for locator in assertion.source_locators
        }
        missing = referenced - source_locators
        if missing:
            raise ValueError("every referenced source locator must be included in sources")
        return self


class RespondInformationRequestCommand(ContributorSubmitCommand):
    request_status_event_id: UUID


class ContributorWithdrawCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    expected_version: int = Field(ge=1)
    locale: Literal["zh", "en"]
    reason: str = Field(min_length=3, max_length=1000)


class AssertionResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    assertion_key: str = Field(pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$")
    disposition: AssertionDisposition
    explanation: str | None = Field(default=None, min_length=3, max_length=2000)
    public_reference_id: str | None = Field(default=None, min_length=1, max_length=255)


class ProjectContributorStatusCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    expected_version: int = Field(ge=1)
    status: ContributorStatus
    active_revision_number: int | None = Field(default=None, ge=1)
    user_visible_reason: str | None = Field(default=None, min_length=3, max_length=2000)
    action_required_fields: list[str] = Field(default_factory=list, max_length=25)
    assertion_results: list[AssertionResultInput] = Field(default_factory=list, max_length=25)
    target_redirect_id: str | None = Field(default=None, min_length=1, max_length=255)
    source_context: Literal["review", "curation", "projection", "target_lifecycle"]
    source_event_id: UUID | None = None

    @model_validator(mode="after")
    def validate_status_payload(self) -> ProjectContributorStatusCommand:
        if self.status is ContributorStatus.ACTION_REQUIRED:
            if not self.user_visible_reason or not self.action_required_fields:
                raise ValueError("action_required requires visible reason and requested fields")
        if self.status is ContributorStatus.TARGET_MERGED and not self.target_redirect_id:
            raise ValueError("target_merged requires target_redirect_id")
        if self.status in {
            ContributorStatus.DRAFT,
            ContributorStatus.SUBMITTED,
            ContributorStatus.WITHDRAWN,
        }:
            raise ValueError("contributor lifecycle statuses are not projected by staff")
        keys = [result.assertion_key for result in self.assertion_results]
        if len(set(keys)) != len(keys):
            raise ValueError("assertion result keys must be unique")
        return self


class ContributorStatusEventView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status_event_id: UUID
    status: ContributorStatus
    active_revision_number: int | None
    user_visible_reason: str | None
    action_required_fields: list[str]
    target_redirect_id: str | None
    occurred_at: datetime


class AssertionResultView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    assertion_key: str
    revision_number: int
    disposition: AssertionDisposition
    explanation: str | None
    public_reference_id: str | None
    created_at: datetime


class ContributorSubmissionSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    submission_id: UUID
    submission_type: SubmissionType
    target_type: SubmissionTargetType
    target_id: str
    public_version_seen: str
    state: SubmissionState
    contributor_status: ContributorStatus
    version: int
    latest_revision_number: int
    user_visible_reason: str | None
    created_at: datetime
    updated_at: datetime


class ContributorSubmissionView(ContributorSubmissionSummary):
    draft_content: dict[str, Any]
    expires_at: datetime
    submitted_at: datetime | None
    withdrawn_at: datetime | None
    closed_at: datetime | None
    revisions: list[SubmissionRevisionView] = Field(default_factory=list)
    attachments: list[AttachmentView] = Field(default_factory=list)
    status_history: list[ContributorStatusEventView] = Field(default_factory=list)
    assertion_results: list[AssertionResultView] = Field(default_factory=list)


class ContributorSubmissionPage(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[ContributorSubmissionSummary]
    next_cursor: str | None = None


class ContributorSubmissionAnalytics(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    total: int
    open_count: int
    action_required_count: int
    by_status: dict[ContributorStatus, int]
    latest_activity_at: datetime | None


class ContributorCommandResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    submission: ContributorSubmissionView
    inline_confirmation: bool = False
    notification_created: bool = False
