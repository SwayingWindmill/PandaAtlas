from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.community_curation.models import (
    AssertionBridgeRead,
    CommunityBridgeCommand,
    CommunityCurationMetricsRead,
    ProjectionResultRead,
    RecordProjectionCommand,
    RecordReleaseCommand,
    ReleaseObservationRead,
)
from app.community_curation.service import (
    bridge_metrics,
    create_bridge,
    get_bridge,
    record_projection,
    record_release,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/community-curation")

BridgeCreator = Annotated[
    RequestIdentity,
    Depends(require_capability("community_curation.bridge.create")),
]
BridgeReader = Annotated[
    RequestIdentity,
    Depends(require_capability("community_curation.bridge.read")),
]
BridgeConsumer = Annotated[
    RequestIdentity,
    Depends(require_capability("community_curation.bridge.consume")),
]
BridgeMetricsReader = Annotated[
    RequestIdentity,
    Depends(require_capability("community_curation.bridge.metrics")),
]


@router.post(
    "/review-cases/{review_case_id}/bridge",
    response_model=AssertionBridgeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_bridge_endpoint(
    review_case_id: UUID,
    command: CommunityBridgeCommand,
    identity: BridgeCreator,
) -> AssertionBridgeRead:
    return create_bridge(review_case_id, command, identity)


@router.get("/bridges/{bridge_id}", response_model=AssertionBridgeRead)
def get_bridge_endpoint(
    bridge_id: UUID,
    identity: BridgeReader,
) -> AssertionBridgeRead:
    _ = identity
    return get_bridge(bridge_id)


@router.post(
    "/releases/{release_id}/observed",
    response_model=ReleaseObservationRead,
)
def record_release_endpoint(
    release_id: UUID,
    command: RecordReleaseCommand,
    identity: BridgeConsumer,
) -> ReleaseObservationRead:
    return record_release(release_id, command, identity)


@router.post(
    "/bridges/{bridge_id}/releases/{release_id}/projection-result",
    response_model=ProjectionResultRead,
)
def record_projection_endpoint(
    bridge_id: UUID,
    release_id: UUID,
    command: RecordProjectionCommand,
    identity: BridgeConsumer,
) -> ProjectionResultRead:
    return record_projection(bridge_id, release_id, command, identity)


@router.get("/bridge-metrics", response_model=CommunityCurationMetricsRead)
def bridge_metrics_endpoint(identity: BridgeMetricsReader) -> CommunityCurationMetricsRead:
    _ = identity
    return bridge_metrics()
