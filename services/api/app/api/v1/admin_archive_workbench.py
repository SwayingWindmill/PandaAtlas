from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.archive_workbench.models import (
    ArchiveCutoverCommand,
    ArchiveCutoverControlRead,
    ArchiveRehearsalSnapshotRead,
    ArchiveWorkbenchDetailRead,
    ArchiveWorkbenchListRead,
    ArchiveWorkbenchMetricsRead,
    ArchiveWorkbenchQueue,
)
from app.archive_workbench.service import (
    cutover_control,
    list_workbench_items,
    rehearsal_snapshot,
    set_cutover_control,
    workbench_detail,
    workbench_metrics,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/archive/workbench")

ArchiveWorkbenchReader = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.workbench.read", legacy_mode="workflow")),
]
ArchiveCutoverManager = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.cutover.manage", legacy_mode="workflow")),
]
ArchiveWorkbenchQueueQuery = Annotated[ArchiveWorkbenchQueue, Query()]
ArchiveWorkbenchLimitQuery = Annotated[int, Query(ge=1, le=200)]


@router.get("", response_model=ArchiveWorkbenchListRead)
def list_archive_workbench_endpoint(
    identity: ArchiveWorkbenchReader,
    queue: ArchiveWorkbenchQueueQuery = ArchiveWorkbenchQueue.ALL,
    limit: ArchiveWorkbenchLimitQuery = 100,
) -> ArchiveWorkbenchListRead:
    _ = identity
    return list_workbench_items(queue, limit=limit)


@router.get("/metrics", response_model=ArchiveWorkbenchMetricsRead)
def archive_workbench_metrics_endpoint(
    identity: ArchiveWorkbenchReader,
) -> ArchiveWorkbenchMetricsRead:
    _ = identity
    return workbench_metrics()


@router.get("/items/{item_id}", response_model=ArchiveWorkbenchDetailRead)
def archive_workbench_detail_endpoint(
    item_id: UUID,
    identity: ArchiveWorkbenchReader,
) -> ArchiveWorkbenchDetailRead:
    _ = identity
    return workbench_detail(item_id)


@router.get("/cutover", response_model=ArchiveCutoverControlRead)
def archive_cutover_control_endpoint(
    identity: ArchiveWorkbenchReader,
) -> ArchiveCutoverControlRead:
    _ = identity
    return cutover_control()


@router.post("/cutover", response_model=ArchiveCutoverControlRead)
def set_archive_cutover_control_endpoint(
    command: ArchiveCutoverCommand,
    identity: ArchiveCutoverManager,
) -> ArchiveCutoverControlRead:
    return set_cutover_control(command, identity)


@router.get("/rehearsal-snapshot", response_model=ArchiveRehearsalSnapshotRead)
def archive_rehearsal_snapshot_endpoint(
    identity: ArchiveWorkbenchReader,
) -> ArchiveRehearsalSnapshotRead:
    _ = identity
    return rehearsal_snapshot()
