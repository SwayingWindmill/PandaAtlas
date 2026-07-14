from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.security import require_workflow_actor
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetRead,
    ChangeSetReview,
    PublicationAction,
    PublicationBatchCreate,
    PublicationBatchRead,
    PublicationPreviewRead,
)
from app.services.publication_service import (
    create_change_set,
    create_publication_batch,
    preview_publication_batch,
    publish_batch,
    review_change_set,
    rollback_to_batch,
    submit_change_set,
    withdraw_batch,
)

router = APIRouter(prefix="/admin")
ActorId = Annotated[UUID, Depends(require_workflow_actor)]


@router.post(
    "/change-sets",
    response_model=ChangeSetRead,
    status_code=status.HTTP_201_CREATED,
)
def create_change_set_endpoint(payload: ChangeSetCreate, actor_id: ActorId) -> ChangeSetRead:
    return create_change_set(payload, actor_id)


@router.post("/change-sets/{change_set_id}/submit", response_model=ChangeSetRead)
def submit_change_set_endpoint(change_set_id: UUID, actor_id: ActorId) -> ChangeSetRead:
    return submit_change_set(change_set_id, actor_id)


@router.post("/change-sets/{change_set_id}/reviews", response_model=ChangeSetRead)
def review_change_set_endpoint(
    change_set_id: UUID,
    payload: ChangeSetReview,
    actor_id: ActorId,
) -> ChangeSetRead:
    return review_change_set(change_set_id, payload, actor_id)


@router.post(
    "/publication-batches",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def create_publication_batch_endpoint(
    payload: PublicationBatchCreate,
    actor_id: ActorId,
) -> PublicationBatchRead:
    return create_publication_batch(payload, actor_id)


@router.get(
    "/publication-batches/{batch_id}/preview",
    response_model=PublicationPreviewRead,
)
def preview_publication_batch_endpoint(
    batch_id: UUID,
    actor_id: ActorId,
) -> PublicationPreviewRead:
    _ = actor_id
    return preview_publication_batch(batch_id)


@router.post(
    "/publication-batches/{batch_id}/publish",
    response_model=PublicationBatchRead,
)
def publish_batch_endpoint(batch_id: UUID, actor_id: ActorId) -> PublicationBatchRead:
    return publish_batch(batch_id, actor_id)


@router.post(
    "/publication-batches/{batch_id}/rollback",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def rollback_to_batch_endpoint(
    batch_id: UUID,
    payload: PublicationAction,
    actor_id: ActorId,
) -> PublicationBatchRead:
    return rollback_to_batch(batch_id, payload, actor_id)


@router.post(
    "/publication-batches/{batch_id}/withdraw",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def withdraw_batch_endpoint(
    batch_id: UUID,
    payload: PublicationAction,
    actor_id: ActorId,
) -> PublicationBatchRead:
    return withdraw_batch(batch_id, payload, actor_id)
