from datetime import date

from pydantic import BaseModel


class OverviewStats(BaseModel):
    total_pandas: int
    active_habitats: int
    latest_snapshot_date: date
    wild_distribution_cells: int
    featured_pandas: int
