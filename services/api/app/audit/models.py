from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReasonText = Annotated[str, Field(min_length=3, max_length=1000)]
IdempotencyKey = Annotated[str, Field(min_length=8, max_length=255)]


class AuditRoleSnapshotRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    role_key: str
    assignment_id: UUID


class AuditEventRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    event_id: UUID
    source_context: str
    source_event_id: UUID
    event_class: str
    actor_account_id: UUID | None
    actor_subject_hash: str | None
    subject_account_id: UUID | None
    actor_role_snapshot: list[AuditRoleSnapshotRead]
    action: str
    target_type: str
    target_id: str
    request_id: str | None
    idempotency_key: str | None
    correlation_id: UUID
    reason: str
    result: str
    related_case_id: str | None
    related_release_id: str | None
    before_version: str | None
    after_version: str | None
    diff_hash: str | None
    details_hash: str
    sensitive_read: bool
    bulk_count: int
    occurred_at: datetime
    projected_at: datetime


class AuditEventList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[AuditEventRead]


class GenerateAuditIntegritySummaryCommand(BaseModel):
    model_config = ConfigDict(frozen=True)

    range_started_at: datetime
    range_ended_at: datetime
    reason: ReasonText
    idempotency_key: IdempotencyKey

    @model_validator(mode="after")
    def validate_range(self) -> GenerateAuditIntegritySummaryCommand:
        if self.range_ended_at <= self.range_started_at:
            raise ValueError("range_ended_at must be after range_started_at")
        return self


class VerifyAuditIntegritySummaryCommand(BaseModel):
    model_config = ConfigDict(frozen=True)

    reason: ReasonText
    idempotency_key: IdempotencyKey


class AuditIntegritySummaryRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    summary_id: UUID
    range_started_at: datetime
    range_ended_at: datetime
    event_count: int
    digest_sha256: str
    previous_digest_sha256: str | None
    generated_by_account_id: UUID
    generated_at: datetime
    reason: str
    correlation_id: UUID
    idempotency_key: str


class AuditIntegritySummaryList(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: list[AuditIntegritySummaryRead]


class AuditIntegrityCheckRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    check_id: UUID
    summary_id: UUID
    expected_digest_sha256: str
    actual_digest_sha256: str
    matched: bool
    checked_by_account_id: UUID
    checked_at: datetime
    reason: str
    correlation_id: UUID
    idempotency_key: str


class AuditMetricsRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    projected_event_count: int
    source_projection_gap_count: int
    sensitive_read_count_24h: int
    bulk_sensitive_read_count_24h: int
    rejected_payload_count_24h: int
    export_event_count_24h: int
    expired_export_artifact_count: int
    maintenance_run_count_24h: int
    integrity_mismatch_count_24h: int
    latest_integrity_generated_at: datetime | None
    alerts: list[str]


class AuditExportScope(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_context: Annotated[str | None, Field(default=None, min_length=2, max_length=64)]
    action: Annotated[str | None, Field(default=None, min_length=3, max_length=160)]
    target_type: Annotated[str | None, Field(default=None, min_length=1, max_length=100)]
    actor_account_id: UUID | None = None
    result: Annotated[str | None, Field(default=None, min_length=1, max_length=100)]
    sensitive_only: bool | None = None
    occurred_after: datetime | None = None
    occurred_before: datetime | None = None

    @model_validator(mode="after")
    def validate_range(self) -> AuditExportScope:
        if (
            self.occurred_after is not None
            and self.occurred_before is not None
            and self.occurred_before <= self.occurred_after
        ):
            raise ValueError("occurred_before must be after occurred_after")
        return self


class CreateAuditExportCommand(BaseModel):
    model_config = ConfigDict(frozen=True)

    scope: AuditExportScope
    reason: ReasonText
    expires_in_seconds: Annotated[int, Field(default=3600, ge=60, le=86400)]
    idempotency_key: IdempotencyKey


class AuditExportArtifactRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    artifact_id: UUID
    scope_hash: str
    file_sha256: str
    content_type: str
    row_count: int
    byte_size: int
    encryption_algorithm: str
    key_version: int
    generated_by_account_id: UUID
    reason: str
    created_at: datetime
    expires_at: datetime


class RunAuditMaintenanceCommand(BaseModel):
    model_config = ConfigDict(frozen=True)

    reason: ReasonText
    idempotency_key: IdempotencyKey


class AuditMaintenanceRunRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    run_id: UUID
    actor_account_id: UUID
    reason: str
    expired_export_count: int
    started_at: datetime
    completed_at: datetime
    correlation_id: UUID
    idempotency_key: str
