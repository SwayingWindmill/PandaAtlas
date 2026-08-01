from datetime import date

from fastapi import APIRouter, Query

from app.api.v1.release_responses import PUBLIC_RELEASE_RESPONSES
from app.schemas.public_experience import PublicMomentsResponse
from app.services.public_experience_service import list_public_moments

router = APIRouter(prefix="/moments")


@router.get(
    "",
    response_model=PublicMomentsResponse,
    responses=PUBLIC_RELEASE_RESPONSES,
)
def list_moments_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    date_from: date | None = None,
    date_to: date | None = None,
    year: int | None = Query(default=None, ge=1800, le=2200),
    panda_ref: str | None = None,
    event_type: str | None = None,
    event_status: str | None = None,
    include_anniversaries: bool = False,
    sort: str = Query(default="date_asc", pattern="^(date_asc|date_desc)$"),
) -> PublicMomentsResponse:
    return list_public_moments(
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        year=year,
        panda_ref=panda_ref,
        event_type=event_type,
        event_status=event_status,
        include_anniversaries=include_anniversaries,
        sort=sort,
    )
