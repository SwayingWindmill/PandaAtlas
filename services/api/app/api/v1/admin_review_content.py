from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text

from app.core.config import settings
from app.db.session import has_database, session_scope
from app.identity.models import RequestIdentity
from app.identity.security import require_capability

router = APIRouter(prefix="/admin")
ReviewContentReader = Annotated[
    RequestIdentity,
    Depends(require_capability("review.case.read")),
]


class ActiveReviewRevision(BaseModel):
    model_config = ConfigDict(frozen=True)

    review_case_id: UUID
    submission_id: UUID
    revision_number: int
    public_version_seen: str
    submitted_at: str
    content: dict[str, Any]


@router.get(
    "/review-cases/{review_case_id}/active-revision",
    response_model=ActiveReviewRevision,
)
def get_active_review_revision(
    review_case_id: UUID,
    identity: ReviewContentReader,
) -> ActiveReviewRevision:
    _ = identity
    if not settings.review_moderation_enabled:
        raise HTTPException(status_code=404, detail={"code": "review_moderation_disabled"})
    if not has_database():
        raise HTTPException(status_code=503, detail={"code": "authoritative_database_unavailable"})
    with session_scope() as session:
        if session is None:
            raise HTTPException(
                status_code=503,
                detail={"code": "authoritative_database_unavailable"},
            )
        row = session.execute(
            text(
                """
                select review_case.review_case_id, review_case.submission_id,
                       review_case.active_revision_number as revision_number,
                       revision.public_version_seen,
                       revision.submitted_at::text,
                       revision.content
                from review_moderation.review_cases review_case
                join community_intake.submission_revisions revision
                  on revision.submission_id = review_case.submission_id
                 and revision.revision_number = review_case.active_revision_number
                where review_case.review_case_id = :review_case_id
                """
            ),
            {"review_case_id": review_case_id},
        ).mappings().first()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "review_case_not_found"})
        return ActiveReviewRevision(**row)
