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
