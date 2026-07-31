from __future__ import annotations

import json
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.archive_publication.models import ArchiveRiskLevel


class ArchiveOperationType(StrEnum):
    ROLLBACK = "rollback"
    TARGETED_CORRECTION = "targeted_correction"
    RETRACTION = "retraction"
    MERGE = "merge"
    SPLIT = "split"
    EMERGENCY_TAKEDOWN = "emergency_takedown"


class ArchiveEntityRef(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    entity_type: str = Field(min_length=1, max_length=120)
    entity_id: str = Field(min_length=1, max_length=255)


class ArchiveImpactPreview(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    follow_count: int = Field(default=0, ge=0)
    activity_count: int = Field(default=0, ge=0)
    slug_alias_count: int = Field(default=0, ge=0)
    relationship_count: int = Field(default=0, ge=0)
    residency_count: int = Field(default=0, ge=0)
    media_count: int = Field(default=0, ge=0)
    source_count: int = Field(default=0, ge=0)
    public_urls: list[str] = Field(default_factory=list, max_length=200)
    warnings: list[str] = Field(default_factory=list, max_length=200)


class ArchiveOperationCommandBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_archive_release_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    data_version: str = Field(min_length=1, max_length=120)
    risk_level: ArchiveRiskLevel
    correlation_id: UUID
    public_schema_version: Literal["1.0.0"] = "1.0.0"
    database_migration_version: str = Field(default="0022", max_length=120)
    projection_code_version: str = Field(default="public-release-v2", max_length=200)


class ArchiveRollbackCommand(ArchiveOperationCommandBase):
    target_release_id: UUID
    complex_rollback: bool = False


class ArchiveCorrectionCommand(ArchiveOperationCommandBase):
    operation_type: Literal[
        ArchiveOperationType.TARGETED_CORRECTION,
        ArchiveOperationType.RETRACTION,
    ]
    subject: ArchiveEntityRef
    effect_payload: dict[str, object]
    impact_preview: ArchiveImpactPreview
    notification_eligible: bool = True

    @model_validator(mode="after")
    def require_effect_payload(self) -> ArchiveCorrectionCommand:
        if not self.effect_payload:
            raise ValueError("correction and retraction commands require effect_payload")
        return self


class ArchiveMergeSplitCommand(ArchiveOperationCommandBase):
    operation_type: Literal[ArchiveOperationType.MERGE, ArchiveOperationType.SPLIT]
    source_entities: list[ArchiveEntityRef] = Field(min_length=1, max_length=50)
    destination_entities: list[ArchiveEntityRef] = Field(min_length=1, max_length=50)
    alias_redirects: dict[str, str] = Field(default_factory=dict)
    effect_payload: dict[str, object]
    impact_preview: ArchiveImpactPreview

    @model_validator(mode="after")
    def validate_shape(self) -> ArchiveMergeSplitCommand:
        source_ids = {(item.entity_type, item.entity_id) for item in self.source_entities}
        destination_ids = {
            (item.entity_type, item.entity_id) for item in self.destination_entities
        }
        if len(source_ids) != len(self.source_entities):
            raise ValueError("source_entities must be unique")
        if len(destination_ids) != len(self.destination_entities):
            raise ValueError("destination_entities must be unique")
        if self.operation_type is ArchiveOperationType.MERGE:
            if len(self.source_entities) < 2 or len(self.destination_entities) != 1:
                raise ValueError("merge requires at least two sources and one destination")
        if self.operation_type is ArchiveOperationType.SPLIT:
            if len(self.source_entities) != 1 or len(self.destination_entities) < 2:
                raise ValueError("split requires one source and at least two destinations")
        if not self.effect_payload:
            raise ValueError("merge and split commands require effect_payload")
        return self


class ArchiveEmergencyTakedownCommand(ArchiveOperationCommandBase):
    subject: ArchiveEntityRef
    public_scope: str = Field(min_length=1, max_length=500)
    effect_payload: dict[str, object]
    impact_preview: ArchiveImpactPreview
    reduction_only: Literal[True] = True

    @model_validator(mode="after")
    def require_effect_payload(self) -> ArchiveEmergencyTakedownCommand:
        if not self.effect_payload:
            raise ValueError("emergency takedown requires effect_payload")
        return self


class EmergencyFollowupCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_operation_id: UUID
    followup_change_set_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    correlation_id: UUID


class ArchiveOperationRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    operation_id: UUID
    release_id: UUID
    operation_type: ArchiveOperationType
    target_release_id: UUID | None
    subject: ArchiveEntityRef | None
    source_entities: list[ArchiveEntityRef]
    destination_entities: list[ArchiveEntityRef]
    risk_level: ArchiveRiskLevel
    effect_payload: dict[str, object]
    impact_preview: ArchiveImpactPreview
    actor_account_id: UUID
    reason: str
    correlation_id: UUID
    outbox_event_id: UUID
    public_projection_status: Literal["pending", "projected"]
    followup_due_at: datetime | None
    created_at: datetime


class EmergencyFollowupRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    operation_id: UUID
    followup_change_set_id: UUID
    completed_by: UUID
    completed_at: datetime
    correlation_id: UUID


class ArchiveOperationMetricsRead(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    rollback_count: int = Field(ge=0)
    targeted_correction_count: int = Field(ge=0)
    retraction_count: int = Field(ge=0)
    merge_count: int = Field(ge=0)
    split_count: int = Field(ge=0)
    emergency_takedown_count: int = Field(ge=0)
    pending_projection_count: int = Field(ge=0)
    overdue_emergency_followup_count: int = Field(ge=0)


def operation_payload_sha256(command: BaseModel) -> str:
    encoded = json.dumps(
        command.model_dump(mode="json"),
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return sha256(encoded).hexdigest()
