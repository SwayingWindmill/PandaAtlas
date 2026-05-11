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
from app.data.mock_data import MOCK_DISTRIBUTION, MOCK_HABITATS, MOCK_PANDAS
from app.db.session import has_database, session_scope
from app.schemas.stats import OverviewStats


def _overview_from_mock() -> OverviewStats:
    featured = sum(1 for item in MOCK_PANDAS if "featured" in item.get("tags", []))
    snapshot_dates = [
        date.fromisoformat(str(feature.get("properties", {}).get("snapshot_date")))
        for feature in MOCK_DISTRIBUTION.get("features", [])
        if feature.get("properties", {}).get("snapshot_date")
    ]
    latest_snapshot = max(snapshot_dates) if snapshot_dates else date.today()
    latest_snapshot_iso = latest_snapshot.isoformat()
    wild_cells = sum(
        1
        for feature in MOCK_DISTRIBUTION.get("features", [])
        if feature.get("properties", {}).get("layer") == "wild"
        and feature.get("properties", {}).get("snapshot_date") == latest_snapshot_iso
    )

    return OverviewStats(
        total_pandas=len(MOCK_PANDAS),
        active_habitats=len(MOCK_HABITATS.get("features", [])),
        latest_snapshot_date=latest_snapshot,
        wild_distribution_cells=wild_cells,
        featured_pandas=featured,
    )


def _overview_from_db() -> OverviewStats:
    if text is None:
        raise SQLAlchemyError("SQLAlchemy text() unavailable")

    sql = text(
        """
        select
          (select count(*) from public.pandas) as total_pandas,
          (select count(*) from public.habitats) as active_habitats,
          (select max(snapshot_date) from public.distribution_snapshots) as latest_snapshot_date,
          (
            select count(*)
            from public.distribution_cells dc
            join public.distribution_snapshots ds on ds.id = dc.snapshot_id
            where dc.layer::text = 'wild'
              and ds.snapshot_date = (select max(snapshot_date) from public.distribution_snapshots)
          ) as wild_distribution_cells,
          (select count(*) from public.pandas where is_featured = true) as featured_pandas
        """
    )

    with session_scope() as session:
        if session is None:
            raise SQLAlchemyError("Database session unavailable")
        row = session.execute(sql).mappings().one()

    latest_snapshot = row["latest_snapshot_date"] or date.today()

    return OverviewStats(
        total_pandas=int(row["total_pandas"] or 0),
        active_habitats=int(row["active_habitats"] or 0),
        latest_snapshot_date=latest_snapshot,
        wild_distribution_cells=int(row["wild_distribution_cells"] or 0),
        featured_pandas=int(row["featured_pandas"] or 0),
    )


def get_overview_stats() -> OverviewStats:
    if has_database():
        try:
            return _overview_from_db()
        except SQLAlchemyError as err:
            if not settings.db_use_mock_fallback:
                raise HTTPException(status_code=503, detail="Database unavailable") from err

    return _overview_from_mock()

