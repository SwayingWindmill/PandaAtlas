from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.integration.events import AggregateReference, IntegrationEventEnvelope

REPO_ROOT = Path(__file__).resolve().parents[4]
CONTRACT_PATH = REPO_ROOT / "contracts" / "integration-event.v1.json"


def test_integration_event_envelope_matches_the_checked_contract() -> None:
    correlation_id = uuid4()
    event = IntegrationEventEnvelope(
        event_type="identity.follow-created",
        event_version=1,
        source_context="identity-engagement",
        aggregate=AggregateReference(type="follow", id="follow-123", version=4),
        idempotency_key="follow:user-1:panda-1",
        correlation_id=correlation_id,
        occurred_at=datetime(2026, 7, 28, 12, 0, tzinfo=UTC),
        payload={"account_id": "user-1", "panda_id": "panda-1"},
    )

    serialized = event.model_dump(mode="json")
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    assert contract["properties"]["schema_version"]["const"] == 1
    assert set(contract["required"]) <= set(serialized)
    assert serialized["schema_version"] == 1
    assert serialized["correlation_id"] == str(correlation_id)
    assert serialized["aggregate"] == {"type": "follow", "id": "follow-123", "version": 4}
    assert event.to_outbox_record()["aggregate_type"] == "follow"
    assert event.to_outbox_record()["payload"]["panda_id"] == "panda-1"


def test_integration_event_rejects_unknown_fields_and_invalid_names() -> None:
    with pytest.raises(ValidationError):
        IntegrationEventEnvelope(
            event_type="FollowCreated",
            source_context="identity-engagement",
            aggregate=AggregateReference(type="follow", id="follow-123"),
            idempotency_key="key",
            correlation_id=uuid4(),
            payload={},
            unexpected=True,
        )


def test_integration_event_requires_timezone_and_non_self_causation() -> None:
    event_id = uuid4()

    with pytest.raises(ValidationError, match="timezone"):
        IntegrationEventEnvelope(
            event_type="identity.follow-created",
            source_context="identity-engagement",
            aggregate=AggregateReference(type="follow", id="follow-123"),
            idempotency_key="key",
            correlation_id=uuid4(),
            occurred_at=datetime(2026, 7, 28, 12, 0),
            payload={},
        )

    with pytest.raises(ValidationError, match="causation_id"):
        IntegrationEventEnvelope(
            event_id=event_id,
            event_type="identity.follow-created",
            source_context="identity-engagement",
            aggregate=AggregateReference(type="follow", id="follow-123"),
            idempotency_key="key",
            correlation_id=uuid4(),
            causation_id=event_id,
            payload={},
        )
