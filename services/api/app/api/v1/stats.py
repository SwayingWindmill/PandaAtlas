from fastapi import APIRouter

from app.schemas.stats import OverviewStats
from app.services.stats_service import get_overview_stats

router = APIRouter(prefix="/stats")


@router.get("/overview", response_model=OverviewStats)
def get_overview_endpoint() -> OverviewStats:
    return get_overview_stats()
