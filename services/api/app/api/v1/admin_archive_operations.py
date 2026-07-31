from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.archive_operations.models import (
    ArchiveCorrectionCommand,
    ArchiveEmergencyTakedownCommand,
    ArchiveMergeSplitCommand,
    ArchiveOperationMetricsRead,
    ArchiveOperationRead,
    ArchiveRollbackCommand,
    EmergencyFollowupCommand,
    EmergencyFollowupRead,
)
from app.archive_operations.service import (
    complete_emergency_followup,
    correct_or_retract,
    emergency_takedown,
    merge_or_split,
    operation_metrics,
    rollback_release,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/archive/operations")

ArchiveRollbackActor = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.rollback",
            legacy_mode="workflow",
        )
    ),
]
ArchiveCorrectionActor = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.correct",
            legacy_mode="workflow",
        )
    ),
]
ArchiveMergeSplitActor = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.sensitive.merge_split",
            legacy_mode="workflow",
        )
    ),
]
ArchiveTakedownActor = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.sensitive.takedown",
            legacy_mode="workflow",
        )
    ),
]
ArchiveOperationMetricsReader = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.operation_metrics",
            legacy_mode="workflow",
        )
    ),
]


@router.post("/rollback", response_model=ArchiveOperationRead)
def rollback_archive_release_endpoint(
    command: ArchiveRollbackCommand,
    identity: ArchiveRollbackActor,
) -> ArchiveOperationRead:
    return rollback_release(command, identity)


@router.post("/corrections", response_model=ArchiveOperationRead)
def correct_or_retract_archive_endpoint(
    command: ArchiveCorrectionCommand,
    identity: ArchiveCorrectionActor,
) -> ArchiveOperationRead:
    return correct_or_retract(command, identity)


@router.post("/merge-split", response_model=ArchiveOperationRead)
def merge_or_split_archive_entity_endpoint(
    command: ArchiveMergeSplitCommand,
    identity: ArchiveMergeSplitActor,
) -> ArchiveOperationRead:
    return merge_or_split(command, identity)


@router.post("/emergency-takedowns", response_model=ArchiveOperationRead)
def emergency_takedown_endpoint(
    command: ArchiveEmergencyTakedownCommand,
    identity: ArchiveTakedownActor,
) -> ArchiveOperationRead:
    return emergency_takedown(command, identity)


@router.post(
    "/emergency-takedowns/{operation_id}/followup",
    response_model=EmergencyFollowupRead,
)
def complete_emergency_takedown_followup_endpoint(
    operation_id: UUID,
    command: EmergencyFollowupCommand,
    identity: ArchiveTakedownActor,
) -> EmergencyFollowupRead:
    if command.expected_operation_id != operation_id:
        raise HTTPException(
            status_code=409,
            detail={"code": "archive_operation_path_mismatch"},
        )
    return complete_emergency_followup(command, identity)


@router.get("/metrics", response_model=ArchiveOperationMetricsRead)
def archive_operation_metrics_endpoint(
    identity: ArchiveOperationMetricsReader,
) -> ArchiveOperationMetricsRead:
    _ = identity
    return operation_metrics()
