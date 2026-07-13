import type { Env } from "../bindings";
import type { OverviewStats } from "../types";

export async function getOverviewStats(env: Env): Promise<OverviewStats> {
  const row = await env.DB.prepare(
    `
    select
      (select count(*) from pandas) as total_pandas,
      (select count(*) from habitats) as active_habitats,
      (select max(snapshot_date) from distribution_snapshots) as latest_snapshot_date,
      (
        select count(*)
        from distribution_cells dc
        join distribution_snapshots ds on ds.id = dc.snapshot_id
        where dc.layer = 'wild'
          and ds.snapshot_date = (select max(snapshot_date) from distribution_snapshots)
      ) as wild_distribution_cells,
      (select count(*) from pandas where is_featured = 1) as featured_pandas
    `
  ).first<{
    total_pandas: number;
    active_habitats: number;
    latest_snapshot_date: string | null;
    wild_distribution_cells: number;
    featured_pandas: number;
  }>();

  return {
    total_pandas: Number(row?.total_pandas ?? 0),
    active_habitats: Number(row?.active_habitats ?? 0),
    latest_snapshot_date: row?.latest_snapshot_date ?? new Date().toISOString().slice(0, 10),
    wild_distribution_cells: Number(row?.wild_distribution_cells ?? 0),
    featured_pandas: Number(row?.featured_pandas ?? 0)
  };
}
