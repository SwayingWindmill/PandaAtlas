from uuid import UUID

import pytest
from pydantic import ValidationError

from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableValidationCommand,
    ArchiveRiskLevel,
    command_payload_sha256,
)

CORRELATION_ID = UUID("22222222-2222-4222-8222-222222222222")


def test_validation_command_hash_is_deterministic() -> None:
    command = AccountableValidationCommand(
        expected_version=3,
        idempotency_key="validation-command-001",
        base_archive_version="release-42",
        reason="Validated against the active Archive head.",
        risk_level=ArchiveRiskLevel.ORDINARY,
        correlation_id=CORRELATION_ID,
    )

    assert command_payload_sha256(command) == command_payload_sha256(
        AccountableValidationCommand.model_validate(command.model_dump())
    )
    assert len(command_payload_sha256(command)) == 64


def test_publish_command_pins_release_contract_defaults() -> None:
    command = AccountablePublishCommand(
        expected_version=4,
        idempotency_key="publish-command-001",
        reason="Publish the validated ordinary Change Set.",
        data_version="archive-2026-07-30-001",
        correlation_id=CORRELATION_ID,
    )

    assert command.public_schema_version == "1.0.0"
    assert command.database_migration_version == "0020"
    assert command.projection_code_version == "public-release-v2"


def test_risk_classification_is_explicit() -> None:
    assert [risk.value for risk in ArchiveRiskLevel] == ["ordinary", "sensitive"]


def test_commands_reject_short_idempotency_keys() -> None:
    with pytest.raises(ValidationError):
        AccountableValidationCommand(
            expected_version=1,
            idempotency_key="short",
            base_archive_version="unpublished",
            reason="Valid reason.",
            risk_level=ArchiveRiskLevel.SENSITIVE,
            correlation_id=CORRELATION_ID,
        )
