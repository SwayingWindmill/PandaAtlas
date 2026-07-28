from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.identity.models import RequestIdentity
from app.identity.security import require_capability
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
ChangeSetCreator = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.change_set.create",
            legacy_mode="workflow",
        )
    ),
]
ChangeSetSubmitter = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.change_set.submit",
            legacy_mode="workflow",
        )
    ),
]
ChangeSetReviewer = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.review", legacy_mode="workflow")),
]
BatchCreator = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.batch.create", legacy_mode="workflow")),
]
BatchPreviewer = Annotated[
    RequestIdentity,
    Depends(require_capability("archive.batch.preview", legacy_mode="workflow")),
]
BatchPublisher = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.batch.publish",
            recent_auth=True,
            legacy_mode="workflow",
        )
    ),
]
BatchRollbackOperator = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.batch.rollback",
            recent_auth=True,
            legacy_mode="workflow",
        )
    ),
]
BatchWithdrawalOperator = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.batch.withdraw",
            recent_auth=True,
            legacy_mode="workflow",
        )
    ),
]


@router.post(
    "/change-sets",
    response_model=ChangeSetRead,
    status_code=status.HTTP_201_CREATED,
)
def create_change_set_endpoint(
    payload: ChangeSetCreate,
    identity: ChangeSetCreator,
) -> ChangeSetRead:
    return create_change_set(payload, identity.account_id)


@router.post("/change-sets/{change_set_id}/submit", response_model=ChangeSetRead)
def submit_change_set_endpoint(
    change_set_id: UUID,
    identity: ChangeSetSubmitter,
) -> ChangeSetRead:
    return submit_change_set(change_set_id, identity.account_id)


@router.post("/change-sets/{change_set_id}/reviews", response_model=ChangeSetRead)
def review_change_set_endpoint(
    change_set_id: UUID,
    payload: ChangeSetReview,
    identity: ChangeSetReviewer,
) -> ChangeSetRead:
    return review_change_set(change_set_id, payload, identity.account_id)


@router.post(
    "/publication-batches",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def create_publication_batch_endpoint(
    payload: PublicationBatchCreate,
    identity: BatchCreator,
) -> PublicationBatchRead:
    return create_publication_batch(payload, identity.account_id)


@router.get(
    "/publication-batches/{batch_id}/preview",
    response_model=PublicationPreviewRead,
)
def preview_publication_batch_endpoint(
    batch_id: UUID,
    identity: BatchPreviewer,
) -> PublicationPreviewRead:
    _ = identity
    return preview_publication_batch(batch_id)


@router.post(
    "/publication-batches/{batch_id}/publish",
    response_model=PublicationBatchRead,
)
def publish_batch_endpoint(batch_id: UUID, identity: BatchPublisher) -> PublicationBatchRead:
    return publish_batch(batch_id, identity.account_id)


@router.post(
    "/publication-batches/{batch_id}/rollback",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def rollback_to_batch_endpoint(
    batch_id: UUID,
    payload: PublicationAction,
    identity: BatchRollbackOperator,
) -> PublicationBatchRead:
    return rollback_to_batch(batch_id, payload, identity.account_id)


@router.post(
    "/publication-batches/{batch_id}/withdraw",
    response_model=PublicationBatchRead,
    status_code=status.HTTP_201_CREATED,
)
def withdraw_batch_endpoint(
    batch_id: UUID,
    payload: PublicationAction,
    identity: BatchWithdrawalOperator,
) -> PublicationBatchRead:
    return withdraw_batch(batch_id, payload, identity.account_id)
