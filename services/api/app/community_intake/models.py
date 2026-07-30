from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SubmissionType(StrEnum):
    CORRECTION = "correction"
    SOURCED_INFORMATION = "sourced_information"


class SubmissionTargetType(StrEnum):
    PANDA = "panda"


class SubmissionState(StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"
    CLOSED = "closed"


class SourceKind(StrEnum):
    URL = "url"
    PUBLICATION = "publication"
    DOCUMENT = "document"
    OTHER = "other"


class AttachmentState(StrEnum):
    QUARANTINED = "quarantined"
    CLEAN = "clean"
    INFECTED = "infected"
    SCAN_FAILED = "scan_failed"
    DELETED = "deleted"


_ALLOWED_MEDIA_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}


class SubmittedSourceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source_kind: SourceKind
    title: str = Field(min_length=1, max_length=500)
    locator: str = Field(min_length=1, max_length=2000)
    publisher: str | None = Field(default=None, max_length=500)
    published_on: date | None = None

    @field_validator("title", "locator", "publisher")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("value must not be blank")
        return stripped


class CreateDraftCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    submission_type: SubmissionType
    target_type: SubmissionTargetType = SubmissionTargetType.PANDA
    target_id: str = Field(min_length=1, max_length=255)
    public_version_seen: str = Field(min_length=1, max_length=255)
    draft_content: dict[str, Any] = Field(default_factory=dict)


class UpdateDraftCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    expected_version: int = Field(ge=1)
    draft_content: dict[str, Any]
    public_version_seen: str | None = Field(default=None, min_length=1, max_length=255)


class SubmitRevisionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    expected_version: int = Field(ge=1)
    content: dict[str, Any]
    public_version_seen: str = Field(min_length=1, max_length=255)
    sources: list[SubmittedSourceInput] = Field(default_factory=list, max_length=25)

    @model_validator(mode="after")
    def require_structured_content(self) -> SubmitRevisionCommand:
        if not self.content:
            raise ValueError("formal submission content must not be empty")
        normalized_locators = {
            " ".join(source.locator.strip().lower().split())
            for source in self.sources
        }
        if len(normalized_locators) != len(self.sources):
            raise ValueError("submitted sources must have unique locators")
        return self


class WithdrawSubmissionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=1000)


class CloseUnincorporatedCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    expected_version: int = Field(ge=1)
    reason: str = Field(min_length=3, max_length=1000)
    retention_days: int = Field(default=90, ge=1, le=3650)


class PrepareAttachmentUploadCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    original_filename: str = Field(min_length=1, max_length=255)
    media_type: str
    byte_size: int = Field(gt=0, le=10 * 1024 * 1024)

    @field_validator("media_type")
    @classmethod
    def validate_media_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in _ALLOWED_MEDIA_TYPES:
            raise ValueError("unsupported attachment media type")
        return normalized

    @field_validator("original_filename")
    @classmethod
    def sanitize_filename(cls, value: str) -> str:
        value = value.strip().replace("\\", "/").rsplit("/", 1)[-1]
        if not value or value in {".", ".."}:
            raise ValueError("invalid original filename")
        return value


class CompleteAttachmentUploadCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    upload_reference: str = Field(min_length=32, max_length=4096)
    object_version: str = Field(min_length=1, max_length=255)
    content_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class AttachmentScanCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=1, max_length=255)
    outcome: AttachmentState
    scanner_name: str = Field(min_length=1, max_length=255)
    scanner_version: str | None = Field(default=None, max_length=255)
    result_code: str = Field(min_length=1, max_length=255)
    metadata_stripped: bool = False
    preview_object_key: str | None = Field(default=None, min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validate_scan_outcome(self) -> AttachmentScanCommand:
        if self.outcome not in {
            AttachmentState.CLEAN,
            AttachmentState.INFECTED,
            AttachmentState.SCAN_FAILED,
        }:
            raise ValueError("scan outcome must be clean, infected, or scan_failed")
        if self.preview_object_key is not None and self.outcome is not AttachmentState.CLEAN:
            raise ValueError("preview object requires a clean scan")
        return self


class AttachmentAccessCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    purpose: str = Field(min_length=3, max_length=500)
    preview: bool = False


class SignedStorageReference(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    reference: str
    expires_at: datetime


class AttachmentView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    attachment_id: UUID
    submission_id: UUID
    bound_revision_number: int | None
    original_filename: str
    media_type: str
    byte_size: int
    state: AttachmentState
    upload_completed_at: datetime | None
    scan_attempts: int
    last_scan_code: str | None
    last_scanned_at: datetime | None
    metadata_stripped: bool
    created_at: datetime


class SubmittedSourceView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    source_id: UUID
    revision_number: int
    source_kind: SourceKind
    title: str
    locator: str
    publisher: str | None
    published_on: date | None
    created_at: datetime


class SubmissionRevisionView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    revision_number: int
    content: dict[str, Any]
    content_sha256: str
    public_version_seen: str
    submitted_at: datetime
    sources: list[SubmittedSourceView] = Field(default_factory=list)


class SubmissionView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    submission_id: UUID
    submission_type: SubmissionType
    target_type: SubmissionTargetType
    target_id: str
    public_version_seen: str
    state: SubmissionState
    draft_content: dict[str, Any]
    version: int
    latest_revision_number: int
    expires_at: datetime
    submitted_at: datetime | None
    withdrawn_at: datetime | None
    closed_at: datetime | None
    retention_due_at: datetime | None
    retention_completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    revisions: list[SubmissionRevisionView] = Field(default_factory=list)
    attachments: list[AttachmentView] = Field(default_factory=list)


class AttachmentUploadReservation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    attachment: AttachmentView
    upload_reference: SignedStorageReference


class RetentionResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    expired_drafts: int = 0
    closed_submissions_processed: int = 0
    orphan_attachments: int = 0
    scan_retries: int = 0


class ClosedSubmissionRetentionView(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    submission_id: UUID
    state: SubmissionState
    version: int
    retention_due_at: datetime


class CommunityIntakeMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    draft_count: int
    submitted_count: int
    quarantined_count: int
    scan_failed_count: int
    infected_count: int
    clean_count: int
    oldest_quarantined_age_seconds: float
    sensitive_reads_granted: int
    sensitive_reads_denied: int
