from uuid import UUID

from app.archive_workbench.models import (
    ArchiveCutoverCommand,
    ArchiveWorkbenchQueue,
    cutover_payload_sha256,
)

CORRELATION_ID = UUID("11111111-1111-4111-8111-111111111111")


def test_cutover_command_hash_is_deterministic() -> None:
    command = ArchiveCutoverCommand(
        expected_version=3,
        state="held",
        idempotency_key="archive-cutover-001",
        reason="Hold publication for the approved migration rehearsal.",
        correlation_id=CORRELATION_ID,
    )

    assert cutover_payload_sha256(command) == cutover_payload_sha256(
        ArchiveCutoverCommand.model_validate(command.model_dump())
    )
    assert len(cutover_payload_sha256(command)) == 64


def test_workbench_queues_are_explicit() -> None:
    assert {queue.value for queue in ArchiveWorkbenchQueue} == {
        "all",
        "ordinary_ready",
        "sensitive_ready",
        "publish_failed",
        "projection_lag",
        "targeted_correction",
        "retraction",
        "rollback",
        "merge",
        "split",
        "emergency_followup",
    }
