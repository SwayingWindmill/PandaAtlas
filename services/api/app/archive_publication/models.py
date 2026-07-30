from __future__ import annotations

import json
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class ArchiveRiskLevel(StrEnum):
    ORDINARY = "ordinary"
    SENSITIVE = "sensitive"


class ArchiveValidationOutcome(StrEnum):
    VALIDATION_FAILED = "validation_failed"
    READY = "ready"


class AccountableValidationCommand(BaseModel):
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=255)
    base_archive_version: str = Field(min_length=1, max_length=120)
    reason: str = Field(min_length=3, max_length=2000)
    risk_level: ArchiveRiskLevel
    correlation_id: UUID


class AccountablePublishCommand(BaseModel):
    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    data_version: str = Field(min_length=1, max_length=120)
    public_schema_version: Literal["1.0.0"] = "1.0.0"
    database_migration_version: str = Field(default="0020", max_length=120)
    projection_code_version: str = Field(default="public-release-v2", max_length=200)
    correlation_id: UUID


class ArchiveValidationIssueRead(BaseModel):
    category: str
    entity_type: str
    entity_id: str
    detail: str


class AccountableValidationRead(BaseModel):
    validation_result_id: UUID
    change_set_id: UUID
    outcome: ArchiveValidationOutcome
    risk_level: ArchiveRiskLevel
    base_archive_version: str
    validation_hash: str
    governance_version: int
    validated_by: UUID
    validated_at: datetime
    reason: str
    issues: list[ArchiveValidationIssueRead]


class AccountableReleaseRead(BaseModel):
    release_id: UUID
    change_set_id: UUID
    data_version: str
    public_schema_version: str
    database_migration_version: str
    projection_code_version: str
    base_archive_version: str
    previous_release_id: UUID | None
    risk_level: ArchiveRiskLevel
    published_by: UUID
    published_at: datetime
    correlation_id: UUID
    outbox_event_id: UUID
    public_projection_status: Literal["pending", "projected"]


class ArchivePublicationMetricsRead(BaseModel):
    ready_change_sets: int
    published_change_sets: int
    publish_failed_change_sets: int
    stale_base_failures: int
    conflict_failures: int
    pending_outbox_events: int
    oldest_outbox_lag_seconds: int
    projection_lag_releases: int


def command_payload_sha256(command: BaseModel) -> str:
    payload = command.model_dump(mode="json")
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    return sha256(encoded).hexdigest()
