import json
from datetime import date

from fastapi import HTTPException

try:
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError
except ModuleNotFoundError:  # pragma: no cover - runtime fallback for lightweight envs
    text = None

    class SQLAlchemyError(Exception):
        """Fallback error when SQLAlchemy is not installed."""


from app.core.config import settings
from app.data.mock_data import MOCK_DISTRIBUTION, MOCK_HABITATS
from app.db.session import has_database, session_scope
from app.schemas.map import (
    DistributionFeatureCollection,
    DistributionSnapshot,
    DistributionSnapshotList,
    HabitatFeatureCollection,
)


DISTRIBUTION_DEFAULT_LIMIT = 5_000
HABITAT_FEATURE_LIMIT = 2_000


def _distribution_feature_limit(zoom: int | None) -> int:
    if zoom is None:
        return DISTRIBUTION_DEFAULT_LIMIT
    if zoom <= 4:
        return 1_500
    if zoom <= 7:
        return 3_000
    return DISTRIBUTION_DEFAULT_LIMIT


def _parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    parts = [part.strip() for part in bbox.split(",")]
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must contain 4 comma-separated numbers")

    try:
        min_lon, min_lat, max_lon, max_lat = (
            float(parts[0]),
            float(parts[1]),
            float(parts[2]),
            float(parts[3]),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox values must be numbers") from exc

    if min_lon >= max_lon or min_lat >= max_lat:
        raise HTTPException(
            status_code=422, detail="bbox min values must be smaller than max values"
        )

    return min_lon, min_lat, max_lon, max_lat


def _as_geometry(value: object) -> dict[str, object]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {"type": "MultiPolygon", "coordinates": []}


def _iter_positions(value: object) -> list[tuple[float, float]]:
    if isinstance(value, (list, tuple)):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            return [(float(value[0]), float(value[1]))]

        positions: list[tuple[float, float]] = []
        for item in value:
            positions.extend(_iter_positions(item))
        return positions

    return []


def _geometry_intersects_bbox(
    geometry: dict[str, object] | None,
    bbox: tuple[float, float, float, float] | None,
) -> bool:
    if bbox is None:
        return True
    if not geometry:
        return False

    positions = _iter_positions(geometry.get("coordinates"))
    if not positions:
        return False

    min_lon = min(lon for lon, _ in positions)
    max_lon = max(lon for lon, _ in positions)
    min_lat = min(lat for _, lat in positions)
    max_lat = max(lat for _, lat in positions)

    return not (
        max_lon < bbox[0]
        or min_lon > bbox[2]
        or max_lat < bbox[1]
        or min_lat > bbox[3]
    )


def _distribution_from_mock(
    *,
    bbox: tuple[float, float, float, float],
    snapshot_date: date | None,
    layer: str | None = None,
    zoom: int | None = None,
) -> DistributionFeatureCollection:
    snapshot_value = snapshot_date.isoformat() if snapshot_date else None
    features = []
    for feature in MOCK_DISTRIBUTION["features"]:
        if layer and feature.get("properties", {}).get("layer") != layer:
            continue
        if snapshot_value and feature.get("properties", {}).get("snapshot_date") != snapshot_value:
            continue
        if not _geometry_intersects_bbox(feature.get("geometry"), bbox):
            continue
        features.append(feature)

    feature_limit = _distribution_feature_limit(zoom)
    truncated = len(features) > feature_limit
    return DistributionFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features[:feature_limit],
            "meta": {
                "truncated": truncated,
                "limit": feature_limit,
                "requested_zoom": zoom,
            },
        }
    )


def _habitats_from_mock(
    *,
    bbox: tuple[float, float, float, float] | None,
    level: str | None = None,
) -> HabitatFeatureCollection:
    features = []
    for feature in MOCK_HABITATS["features"]:
        if level and feature.get("properties", {}).get("level") != level:
            continue
        if not _geometry_intersects_bbox(feature.get("geometry"), bbox):
            continue
        features.append(feature)

    truncated = len(features) > HABITAT_FEATURE_LIMIT
    return HabitatFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features[:HABITAT_FEATURE_LIMIT],
            "meta": {
                "truncated": truncated,
                "limit": HABITAT_FEATURE_LIMIT,
                "requested_zoom": None,
            },
        }
    )


def _snapshots_from_mock(limit: int) -> DistributionSnapshotList:
    dates = {
        str(feature.get("properties", {}).get("snapshot_date"))
        for feature in MOCK_DISTRIBUTION.get("features", [])
        if feature.get("properties", {}).get("snapshot_date")
    }

    sorted_dates = sorted(dates, reverse=True)
    if not sorted_dates:
        sorted_dates = [date.today().isoformat()]

    items = [
        DistributionSnapshot(snapshot_date=snapshot_date, version=f"mock-v{index + 1}", notes=None)
        for index, snapshot_date in enumerate(sorted_dates[:limit])
    ]
    return DistributionSnapshotList(items=items)


def _distribution_from_db(
    *,
    bbox: tuple[float, float, float, float],
    snapshot_date: date | None,
    layer: str | None,
    zoom: int | None,
) -> DistributionFeatureCollection:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    feature_limit = _distribution_feature_limit(zoom)

    where_clauses = [
        "st_intersects(dc.geom, st_makeenvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326))"
    ]

    if layer:
        where_clauses.append("dc.layer::text = :layer")

    if snapshot_date:
        where_clauses.append("ds.snapshot_date = :snapshot_date")
    else:
        where_clauses.append(
            "ds.snapshot_date = (select max(snapshot_date) from public.distribution_snapshots)"
        )

    sql = text(
        f"""
        select
          dc.id,
          dc.cell_code,
          dc.layer::text as layer,
          dc.density,
          ds.snapshot_date,
          st_asgeojson(dc.geom)::json as geometry
        from public.distribution_cells dc
        join public.distribution_snapshots ds on ds.id = dc.snapshot_id
        where {" and ".join(where_clauses)}
        order by dc.cell_code asc, dc.id asc
        limit :query_limit
        """
    )

    params: dict[str, object] = {
        "min_lon": bbox[0],
        "min_lat": bbox[1],
        "max_lon": bbox[2],
        "max_lat": bbox[3],
        "query_limit": feature_limit + 1,
    }
    if layer:
        params["layer"] = layer
    if snapshot_date:
        params["snapshot_date"] = snapshot_date

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(sql, params).mappings().all()

    truncated = len(rows) > feature_limit
    rows = rows[:feature_limit]

    features = [
        {
            "type": "Feature",
            "id": row["id"],
            "geometry": _as_geometry(row["geometry"]),
            "properties": {
                "cell_code": row["cell_code"],
                "layer": row["layer"],
                "density": row["density"],
                "snapshot_date": row["snapshot_date"].isoformat() if row["snapshot_date"] else None,
            },
        }
        for row in rows
    ]

    return DistributionFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features,
            "meta": {
                "truncated": truncated,
                "limit": feature_limit,
                "requested_zoom": zoom,
            },
        }
    )


def _habitats_from_db(
    *,
    bbox: tuple[float, float, float, float] | None,
    level: str | None,
) -> HabitatFeatureCollection:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    where_clauses = ["1=1"]
    params: dict[str, object] = {"query_limit": HABITAT_FEATURE_LIMIT + 1}

    if level:
        where_clauses.append("h.level = :level")
        params["level"] = level

    if bbox:
        where_clauses.append(
            "st_intersects(h.boundary, "
            "st_makeenvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326))"
        )
        params.update(
            {
                "min_lon": bbox[0],
                "min_lat": bbox[1],
                "max_lon": bbox[2],
                "max_lat": bbox[3],
            }
        )

    sql = text(
        f"""
        select
          h.id,
          h.name,
          h.province,
          h.level,
          st_asgeojson(h.boundary)::json as geometry
        from public.habitats h
        where {" and ".join(where_clauses)}
        order by h.name asc, h.id asc
        limit :query_limit
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(sql, params).mappings().all()

    truncated = len(rows) > HABITAT_FEATURE_LIMIT
    rows = rows[:HABITAT_FEATURE_LIMIT]

    features = [
        {
            "type": "Feature",
            "id": str(row["id"]),
            "geometry": _as_geometry(row["geometry"]),
            "properties": {
                "name": row["name"],
                "province": row["province"],
                "level": row["level"],
            },
        }
        for row in rows
    ]

    return HabitatFeatureCollection.model_validate(
        {
            "type": "FeatureCollection",
            "features": features,
            "meta": {
                "truncated": truncated,
                "limit": HABITAT_FEATURE_LIMIT,
                "requested_zoom": None,
            },
        }
    )


def _snapshots_from_db(limit: int) -> DistributionSnapshotList:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    sql = text(
        """
        select
          snapshot_date,
          version,
          notes
        from public.distribution_snapshots
        order by snapshot_date desc, created_at desc
        limit :limit
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        rows = session.execute(sql, {"limit": limit}).mappings().all()

    return DistributionSnapshotList(
        items=[
            DistributionSnapshot(
                snapshot_date=row["snapshot_date"],
                version=row["version"],
                notes=row["notes"],
            )
            for row in rows
        ]
    )


def get_distribution(
    *,
    bbox: str,
    snapshot_date: date | None = None,
    layer: str | None = None,
    zoom: int | None = None,
) -> DistributionFeatureCollection:
    parsed_bbox = _parse_bbox(bbox)

    if has_database():
        try:
            return _distribution_from_db(
                bbox=parsed_bbox,
                snapshot_date=snapshot_date,
                layer=layer,
                zoom=zoom,
            )
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _distribution_from_mock(
        bbox=parsed_bbox,
        snapshot_date=snapshot_date,
        layer=layer,
        zoom=zoom,
    )


def get_habitats(
    *,
    bbox: str | None = None,
    level: str | None = None,
) -> HabitatFeatureCollection:
    parsed_bbox = _parse_bbox(bbox) if bbox else None

    if has_database():
        try:
            return _habitats_from_db(bbox=parsed_bbox, level=level)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _habitats_from_mock(bbox=parsed_bbox, level=level)


def list_distribution_snapshots(limit: int = 24) -> DistributionSnapshotList:
    if has_database():
        try:
            return _snapshots_from_db(limit=limit)
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _snapshots_from_mock(limit=limit)

