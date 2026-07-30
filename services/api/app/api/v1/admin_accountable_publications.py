from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.archive_publication.models import (
    AccountablePublishCommand,
    AccountableReleaseRead,
    AccountableValidationCommand,
    AccountableValidationRead,
    ArchivePublicationMetricsRead,
)
from app.archive_publication.service import (
    publication_metrics,
    publish_change_set,
    validate_change_set,
)
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin/archive")

AccountableValidator = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.validate",
            legacy_mode="workflow",
        )
    ),
]
AccountablePublisher = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.publish",
            legacy_mode="workflow",
        )
    ),
]
AccountableMetricsReader = Annotated[
    RequestIdentity,
    Depends(
        require_capability(
            "archive.accountable.metrics",
            legacy_mode="workflow",
        )
    ),
]


@router.post(
    "/change-sets/{change_set_id}/validate",
    response_model=AccountableValidationRead,
)
def validate_accountable_change_set_endpoint(
    change_set_id: UUID,
    command: AccountableValidationCommand,
    identity: AccountableValidator,
) -> AccountableValidationRead:
    return validate_change_set(change_set_id, command, identity)


@router.post(
    "/change-sets/{change_set_id}/publish",
    response_model=AccountableReleaseRead,
)
def publish_accountable_change_set_endpoint(
    change_set_id: UUID,
    command: AccountablePublishCommand,
    identity: AccountablePublisher,
) -> AccountableReleaseRead:
    return publish_change_set(change_set_id, command, identity)


@router.get(
    "/publication-metrics",
    response_model=ArchivePublicationMetricsRead,
)
def accountable_publication_metrics_endpoint(
    identity: AccountableMetricsReader,
) -> ArchivePublicationMetricsRead:
    _ = identity
    return publication_metrics()
