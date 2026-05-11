from datetime import date

from fastapi import APIRouter, Query

from app.schemas.map import (
    DistributionFeatureCollection,
    DistributionSnapshotList,
    HabitatFeatureCollection,
)
from app.services.map_service import get_distribution, get_habitats, list_distribution_snapshots

router = APIRouter(prefix="/map")


@router.get("/distribution", response_model=DistributionFeatureCollection)
def get_distribution_endpoint(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    snapshot_date: date | None = None,
    layer: str | None = Query(default=None, pattern="^(wild|captive|protected_area|corridor)$"),
    zoom: int | None = Query(default=None, ge=0, le=22),
) -> DistributionFeatureCollection:
    return get_distribution(
        bbox=bbox,
        snapshot_date=snapshot_date,
        layer=layer,
        zoom=zoom,
    )


@router.get("/habitats", response_model=HabitatFeatureCollection)
def get_habitats_endpoint(
    bbox: str | None = None,
    level: str | None = None,
) -> HabitatFeatureCollection:
    return get_habitats(bbox=bbox, level=level)


@router.get("/snapshots", response_model=DistributionSnapshotList)
def list_snapshots_endpoint(
    limit: int = Query(default=24, ge=1, le=120),
) -> DistributionSnapshotList:
    return list_distribution_snapshots(limit=limit)
