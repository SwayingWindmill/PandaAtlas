from __future__ import annotations

import json
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.archive_publication.models import ArchiveRiskLevel


class ArchiveWorkbenchQueue(StrEnum):
    ALL = "all"
    ORDINARY_READY = "ordinary_ready"
    SENSITIVE_READY = "sensitive_ready"
    PUBLISH_FAILED = "publish_failed"
    PROJECTION_LAG = "projection_lag"
    TARGETED_CORRECTION = "targeted_correction"
    RETRACTION = "retraction"
    ROLLBACK = "rollback"
    MERGE = "merge"
    SPLIT = "split"
    EMERGENCY_FOLLOWUP = "emergency_followup"


class ArchiveWorkbenchItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    item_type: Literal["change_set", "release", "operation"]
    item_id: UUID
    queue: str
    title: str
    status: str
    risk_level: ArchiveRiskLevel
    version: int
    base_archive_version: str | None
    release_id: UUID | None
    operation_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ArchiveWorkbenchListRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    items: list[ArchiveWorkbenchItemRead]
    total: int


class ArchiveWorkbenchMetricsRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ordinary_ready: int = Field(ge=0)
    sensitive_ready: int = Field(ge=0)
    publish_failed: int = Field(ge=0)
    projection_lag: int = Field(ge=0)
    emergency_followup: int = Field(ge=0)
    cutover_state: Literal["open", "held"]
    cutover_version: int = Field(ge=1)


class ArchiveCutoverControlRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    state: Literal["open", "held"]
    version: int = Field(ge=1)
    reason: str
    changed_by: UUID | None
    changed_at: datetime


class ArchiveCutoverCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_version: int = Field(ge=1)
    state: Literal["open", "held"]
    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    correlation_id: UUID


class ArchiveRevisionEvidenceRead(BaseModel):
    model_config = ConfigDict(extra="allow", frozen=True)

    revision_id: UUID | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    revision_number: int | None = None
    payload_sha256: str | None = None


class ArchiveWorkbenchDetailRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    item: ArchiveWorkbenchItemRead
    current_archive_release_id: UUID | None
    current_public_release_id: UUID | None
    current_archive_version: str
    current_public_version: str
    change_set_id: UUID | None
    governance_mode: str | None
    validation_state: str | None
    validation_hash: str | None
    validation_issues: list[dict[str, object]]
    structured_diff: list[ArchiveRevisionEvidenceRead]
    source_evidence: list[dict[str, object]]
    attachment_evidence: list[dict[str, object]]
    release_notes: str | None
    public_impact: dict[str, object]
    operation_effect: dict[str, object]
    operation_subject: dict[str, object] | None
    actor_roles: list[str]
    actor_capabilities: list[str]
    emergency_followup_due_at: datetime | None
    emergency_followup_change_set_id: UUID | None


class ArchiveRehearsalSnapshotRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    generated_at: datetime
    old_state_counts: dict[str, int]
    accountable_state_counts: dict[str, int]
    release_counts: dict[str, int]
    orphan_counts: dict[str, int]
    historical_audit_count: int
    archive_pointer_release_id: UUID | None
    public_pointer_release_id: UUID | None
    canonical_sha256: str
    go: bool
    blockers: list[str]


def cutover_payload_sha256(command: BaseModel) -> str:
    payload = command.model_dump(mode="json")
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    return sha256(encoded).hexdigest()
