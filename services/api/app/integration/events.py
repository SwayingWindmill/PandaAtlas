from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

_NAME_PATTERN = r"^[a-z][a-z0-9_.-]+$"


class AggregateReference(BaseModel):
    """Stable reference to the aggregate that emitted an integration event."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    type: str = Field(min_length=2, max_length=64, pattern=_NAME_PATTERN)
    id: str = Field(min_length=1, max_length=255)
    version: int | None = Field(default=None, ge=0)


class IntegrationEventEnvelope(BaseModel):
    """Versioned transport-neutral envelope persisted in the transactional Outbox."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    event_id: UUID = Field(default_factory=uuid4)
    schema_version: Literal[1] = 1
    event_type: str = Field(min_length=3, max_length=128, pattern=_NAME_PATTERN)
    event_version: int = Field(default=1, ge=1)
    source_context: str = Field(min_length=2, max_length=64, pattern=_NAME_PATTERN)
    aggregate: AggregateReference
    idempotency_key: str = Field(min_length=1, max_length=255)
    correlation_id: UUID
    causation_id: UUID | None = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    payload: dict[str, Any]

    @model_validator(mode="after")
    def validate_causation(self) -> IntegrationEventEnvelope:
        if self.causation_id == self.event_id:
            raise ValueError("causation_id must not equal event_id")
        if self.occurred_at.tzinfo is None or self.occurred_at.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return self

    def to_outbox_record(self) -> dict[str, Any]:
        """Return column-aligned values for ``integration.outbox_events``."""

        return {
            "event_id": self.event_id,
            "schema_version": self.schema_version,
            "event_type": self.event_type,
            "event_version": self.event_version,
            "source_context": self.source_context,
            "aggregate_type": self.aggregate.type,
            "aggregate_id": self.aggregate.id,
            "aggregate_version": self.aggregate.version,
            "idempotency_key": self.idempotency_key,
            "correlation_id": self.correlation_id,
            "causation_id": self.causation_id,
            "occurred_at": self.occurred_at,
            "payload": self.payload,
        }
