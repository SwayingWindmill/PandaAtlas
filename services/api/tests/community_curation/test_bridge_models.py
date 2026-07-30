from uuid import UUID

import pytest
from pydantic import ValidationError

from app.community_curation.models import (
    CommunityBridgeCommand,
    ProjectionOutcome,
    RecordProjectionCommand,
    command_payload_sha256,
)

CORRELATION_ID = UUID("22222222-2222-4222-8222-222222222222")
PROJECTION_EVENT_ID = UUID("33333333-3333-4333-8333-333333333333")


def test_bridge_command_hash_is_deterministic() -> None:
    command = CommunityBridgeCommand(
        expected_version=4,
        idempotency_key="bridge-command-001",
        reason="Bridge accepted assertions into Curation.",
        base_archive_version="archive-2026-07-30-001",
        risk_level="ordinary",
        correlation_id=CORRELATION_ID,
    )

    assert command_payload_sha256(command) == command_payload_sha256(
        CommunityBridgeCommand.model_validate(command.model_dump())
    )
    assert len(command_payload_sha256(command)) == 64


def test_projection_result_requires_public_version_when_projected() -> None:
    with pytest.raises(ValidationError):
        RecordProjectionCommand(
            idempotency_key="projection-command-001",
            projection_event_id=PROJECTION_EVENT_ID,
            outcome=ProjectionOutcome.PROJECTED,
            incorporated_assertion_keys=["name_zh"],
            correlation_id=CORRELATION_ID,
        )


def test_projection_result_rejects_duplicate_assertion_keys() -> None:
    with pytest.raises(ValidationError):
        RecordProjectionCommand(
            idempotency_key="projection-command-002",
            projection_event_id=PROJECTION_EVENT_ID,
            outcome=ProjectionOutcome.FAILED,
            incorporated_assertion_keys=["name_zh", "name_zh"],
            correlation_id=CORRELATION_ID,
        )
