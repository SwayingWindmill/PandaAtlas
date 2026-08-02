from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PrivacyRequestKind(StrEnum):
    ACCESS_EXPORT = "access_export"
    ACCOUNT_DELETION = "account_deletion"


class PrivacyRequestState(StrEnum):
    REQUESTED = "requested"
    VERIFIED = "verified"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PrivacyContextState(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    HELD = "held"
    NOT_APPLICABLE = "not_applicable"


class PrivacyHoldBasis(StrEnum):
    LEGAL_OBLIGATION = "legal_obligation"
    SECURITY_INVESTIGATION = "security_investigation"
    FRAUD_PREVENTION = "fraud_prevention"


class PrivacyHoldState(StrEnum):
    ACTIVE = "active"
    RELEASED = "released"


class PrivacyExportState(StrEnum):
    READY = "ready"
    EXPIRED = "expired"
    DELETED = "deleted"


class PrivacyHoldReleaseReason(StrEnum):
    BASIS_RESOLVED = "basis_resolved"
    REVIEW_EXPIRED = "review_expired"
    SUPERSEDED = "superseded"


class PrivacyCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)


class CreatePrivacyRequestCommand(PrivacyCommand):
    kind: PrivacyRequestKind
    reason: str = Field(min_length=10, max_length=2000)


class VerifyPrivacyRequestCommand(PrivacyCommand):
    expected_version: int = Field(ge=1)


class UpdatePrivacyContextCommand(PrivacyCommand):
    expected_version: int = Field(ge=1)
    state: PrivacyContextState
    internal_error_code: str | None = Field(
        default=None,
        min_length=3,
        max_length=128,
        pattern=r"^[a-z][a-z0-9_.-]+$",
    )


class CreatePrivacyHoldCommand(PrivacyCommand):
    expected_context_version: int = Field(ge=1)
    basis: PrivacyHoldBasis
    review_due_at: datetime


class ReleasePrivacyHoldCommand(PrivacyCommand):
    expected_hold_version: int = Field(ge=1)
    expected_context_version: int = Field(ge=1)
    reason: PrivacyHoldReleaseReason


class ReplayDeletionTombstoneCommand(PrivacyCommand):
    expected_version: int = Field(ge=1)


class ExecutePrivateDeletionCommand(PrivacyCommand):
    expected_context_versions: dict[str, int]


class GeneratePrivacyExportCommand(PrivacyCommand):
    expected_context_versions: dict[str, int]


class DownloadPrivacyExportCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    reference: str = Field(min_length=32, max_length=4096)


class UserPrivacyContextRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    context_key: str
    state: PrivacyContextState
    attempts: int
    updated_at: datetime


class UserPrivacyRequestRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    request_id: UUID
    kind: PrivacyRequestKind
    state: PrivacyRequestState
    version: int
    requested_at: datetime
    completed_at: datetime | None = None
    contexts: list[UserPrivacyContextRead]


class UserPrivacyRequestList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[UserPrivacyRequestRead]


class PrivacyContextRead(UserPrivacyContextRead):
    version: int
    last_error_code: str | None = None


class PrivacyRequestRead(UserPrivacyRequestRead):
    account_id: UUID
    requested_reason: str
    verified_by_account_id: UUID | None = None
    verified_at: datetime | None = None
    processing_started_at: datetime | None = None
    failed_at: datetime | None = None
    failure_code: str | None = None
    contexts: list[PrivacyContextRead]


class PrivacyRequestList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[PrivacyRequestRead]


class PrivacyHoldRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    hold_id: UUID
    request_id: UUID
    account_id: UUID
    context_key: str
    basis: PrivacyHoldBasis
    state: PrivacyHoldState
    version: int
    created_by_account_id: UUID
    created_at: datetime
    review_due_at: datetime
    released_by_account_id: UUID | None = None
    released_at: datetime | None = None
    release_reason: PrivacyHoldReleaseReason | None = None


class PrivacyHoldList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[PrivacyHoldRead]


class DeletionTombstoneRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    account_id: UUID
    context_key: str
    request_id: UUID
    applied_at: datetime
    last_replayed_at: datetime | None = None
    replay_count: int
    version: int


class PrivacyExportRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact_id: UUID
    request_id: UUID
    state: PrivacyExportState
    schema_version: int
    plaintext_byte_size: int
    created_at: datetime
    expires_at: datetime


class PrivacyExportAccessRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact: PrivacyExportRead
    reference: str
    expires_at: datetime
