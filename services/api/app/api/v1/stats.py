from fastapi import APIRouter

from app.api.v1.release_responses import PUBLIC_RELEASE_RESPONSES
from app.schemas.stats import OverviewStats
from app.services.release_read_service import get_release_stats

router = APIRouter(prefix="/stats")


@router.get(
    "/overview", response_model=OverviewStats, responses=PUBLIC_RELEASE_RESPONSES
)
def get_overview_endpoint() -> OverviewStats:
    return get_release_stats()
