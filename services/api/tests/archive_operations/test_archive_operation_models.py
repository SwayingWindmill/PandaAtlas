from uuid import UUID

import pytest
from pydantic import ValidationError

from app.archive_operations.models import (
    ArchiveCorrectionCommand,
    ArchiveEmergencyTakedownCommand,
    ArchiveEntityRef,
    ArchiveImpactPreview,
    ArchiveMergeSplitCommand,
    ArchiveOperationType,
    ArchiveRollbackCommand,
    operation_payload_sha256,
)
from app.archive_publication.models import ArchiveRiskLevel

CURRENT_RELEASE = UUID("11111111-1111-4111-8111-111111111111")
TARGET_RELEASE = UUID("22222222-2222-4222-8222-222222222222")
CORRELATION_ID = UUID("33333333-3333-4333-8333-333333333333")


def _base() -> dict[str, object]:
    return {
        "expected_archive_release_id": CURRENT_RELEASE,
        "idempotency_key": "archive-operation-001",
        "reason": "Apply an explicit accountable Archive operation.",
        "data_version": "archive-2026-07-31-001",
        "risk_level": ArchiveRiskLevel.SENSITIVE,
        "correlation_id": CORRELATION_ID,
    }


def test_rollback_command_pins_release_contract() -> None:
    command = ArchiveRollbackCommand(target_release_id=TARGET_RELEASE, **_base())

    assert command.database_migration_version == "0022"
    assert command.public_schema_version == "1.0.0"
    assert command.projection_code_version == "public-release-v2"
    assert len(operation_payload_sha256(command)) == 64


def test_merge_requires_multiple_sources_and_one_destination() -> None:
    command = ArchiveMergeSplitCommand(
        operation_type=ArchiveOperationType.MERGE,
        source_entities=[
            ArchiveEntityRef(entity_type="panda", entity_id="panda-a"),
            ArchiveEntityRef(entity_type="panda", entity_id="panda-b"),
        ],
        destination_entities=[
            ArchiveEntityRef(entity_type="panda", entity_id="panda-a")
        ],
        alias_redirects={"/en/pandas/panda-b": "/en/pandas/panda-a"},
        effect_payload={"canonical_entity_id": "panda-a"},
        impact_preview=ArchiveImpactPreview(
            follow_count=12,
            activity_count=4,
            slug_alias_count=2,
            relationship_count=3,
            residency_count=1,
            media_count=5,
            source_count=7,
            public_urls=["/en/pandas/panda-a", "/en/pandas/panda-b"],
        ),
        **_base(),
    )

    assert command.operation_type is ArchiveOperationType.MERGE
    assert len(command.source_entities) == 2


def test_split_rejects_one_destination() -> None:
    with pytest.raises(ValidationError):
        ArchiveMergeSplitCommand(
            operation_type=ArchiveOperationType.SPLIT,
            source_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id="panda-a")
            ],
            destination_entities=[
                ArchiveEntityRef(entity_type="panda", entity_id="panda-a-1")
            ],
            effect_payload={"reason": "identity separation"},
            impact_preview=ArchiveImpactPreview(),
            **_base(),
        )


def test_correction_requires_effect_payload() -> None:
    with pytest.raises(ValidationError):
        ArchiveCorrectionCommand(
            operation_type=ArchiveOperationType.TARGETED_CORRECTION,
            subject=ArchiveEntityRef(entity_type="panda", entity_id="panda-a"),
            effect_payload={},
            impact_preview=ArchiveImpactPreview(),
            **_base(),
        )


def test_emergency_takedown_is_reduction_only() -> None:
    command = ArchiveEmergencyTakedownCommand(
        subject=ArchiveEntityRef(entity_type="panda", entity_id="panda-a"),
        public_scope="Temporarily suppress one disputed public media item.",
        effect_payload={"media_ids": ["media-1"], "visibility": "suppressed"},
        impact_preview=ArchiveImpactPreview(media_count=1),
        **_base(),
    )

    assert command.reduction_only is True
