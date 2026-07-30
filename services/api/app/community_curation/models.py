from __future__ import annotations

import json
from datetime import datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BridgeRiskLevel(StrEnum):
    ORDINARY = "ordinary"
    SENSITIVE = "sensitive"


class BridgeStatus(StrEnum):
    CREATED = "created"
    RELEASE_SEEN = "release_seen"
    PROJECTED = "projected"
    PROJECTION_FAILED = "projection_failed"


class ProjectionOutcome(StrEnum):
    PROJECTED = "projected"
    FAILED = "failed"


class CommunityBridgeCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    expected_version: int = Field(ge=1)
    idempotency_key: str = Field(min_length=8, max_length=255)
    reason: str = Field(min_length=3, max_length=2000)
    base_archive_version: str = Field(min_length=1, max_length=255)
    risk_level: BridgeRiskLevel = BridgeRiskLevel.ORDINARY
    correlation_id: UUID


class RecordReleaseCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    correlation_id: UUID


class RecordProjectionCommand(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    idempotency_key: str = Field(min_length=8, max_length=255)
    projection_event_id: UUID
    outcome: ProjectionOutcome
    public_version: str | None = Field(default=None, min_length=1, max_length=255)
    incorporated_assertion_keys: list[str] = Field(default_factory=list, max_length=100)
    user_visible_message: str | None = Field(default=None, min_length=3, max_length=2000)
    correlation_id: UUID

    @field_validator("incorporated_assertion_keys")
    @classmethod
    def validate_assertion_keys(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("incorporated assertion keys must be unique")
        for value in values:
            if not value or len(value) > 128:
                raise ValueError("invalid incorporated assertion key")
        return values

    @model_validator(mode="after")
    def validate_projected_payload(self) -> RecordProjectionCommand:
        if self.outcome is ProjectionOutcome.PROJECTED:
            if not self.public_version:
                raise ValueError("projected results require a public version")
            if not self.user_visible_message:
                raise ValueError("projected results require a user-visible message")
        return self


class AssertionBridgeRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    bridge_id: UUID
    review_case_id: UUID
    submission_id: UUID
    revision_number: int
    decision_id: UUID
    change_set_id: UUID
    contributor_account_id: UUID | None = None
    target_type: str
    target_id: str
    base_archive_version: str
    risk_level: BridgeRiskLevel
    selected_assertion_keys: list[str]
    not_recommended_assertion_keys: list[str]
    source_ids: list[UUID]
    attachment_ids: list[UUID]
    actor_account_id: UUID
    actor_role_snapshot: list[str]
    status: BridgeStatus
    change_set_status: str
    governance_mode: str
    validation_state: str
    published_release_id: UUID | None = None
    observed_release_id: UUID | None = None
    observed_data_version: str | None = None
    projection_result_id: UUID | None = None
    projection_outcome: ProjectionOutcome | None = None
    public_version: str | None = None
    notification_intent_id: UUID | None = None
    stuck: bool
    created_at: datetime
    updated_at: datetime


class ReleaseObservationRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    bridge_id: UUID
    change_set_id: UUID
    release_id: UUID


class ProjectionResultRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    projection_result_id: UUID
    contributor_status: Literal["incorporated_full", "incorporated_partial"] | None = None
    notification_intent_id: UUID | None = None


class CommunityCurationMetricsRead(BaseModel):
    model_config = ConfigDict(frozen=True)

    accepted_decisions: int
    bridged_decisions: int
    release_observed_bridges: int
    projected_bridges: int
    projection_failed_bridges: int
    stuck_bridges: int
    broken_release_links: int


def command_payload_sha256(command: BaseModel) -> str:
    encoded = json.dumps(
        command.model_dump(mode="json"),
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return sha256(encoded).hexdigest()
