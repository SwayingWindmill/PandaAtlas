import type { Env } from "../bindings";
import type { BBox } from "../geo";
import { loadGeometry } from "../geo";
import type {
  CompleteGeoJsonFeatureCollection,
  DistributionFeatureProperties,
  DistributionLayer,
  GeoJsonFeature,
  HabitatFeatureProperties
} from "../types";

const DISTRIBUTION_DEFAULT_LIMIT = 5_000;
const HABITAT_FEATURE_LIMIT = 2_000;

function distributionFeatureLimit(zoom: number | null): number {
  if (zoom === null) {
    return DISTRIBUTION_DEFAULT_LIMIT;
  }
  if (zoom <= 4) {
    return 1_500;
  }
  if (zoom <= 7) {
    return 3_000;
  }
  return DISTRIBUTION_DEFAULT_LIMIT;
}

interface DistributionRow {
  id: number;
  cell_code: string;
  layer: DistributionLayer;
  density: number | null;
  snapshot_date: string | null;
  geometry_geojson: string | null;
  geometry_r2_key: string | null;
}

interface HabitatRow {
  id: string;
  name: string;
  province: string | null;
  level: string | null;
  boundary_geojson: string | null;
  boundary_r2_key: string | null;
}

export interface DistributionOptions {
  bbox: BBox;
  snapshotDate: string | null;
  layer: DistributionLayer | null;
  zoom: number | null;
}

export async function getDistribution(
  env: Env,
  options: DistributionOptions
): Promise<CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>> {
  const snapshotDate =
    options.snapshotDate ??
    (
      await env.DB.prepare("select max(snapshot_date) as snapshot_date from distribution_snapshots").first<{
        snapshot_date: string | null;
      }>()
    )?.snapshot_date;
  const featureLimit = distributionFeatureLimit(options.zoom);

  const where: string[] = [
    "not (dc.max_lng < ? or dc.min_lng > ? or dc.max_lat < ? or dc.min_lat > ?)"
  ];
  const values: unknown[] = [
    options.bbox.minLng,
    options.bbox.maxLng,
    options.bbox.minLat,
    options.bbox.maxLat
  ];

  if (snapshotDate) {
    where.push("ds.snapshot_date = ?");
    values.push(snapshotDate);
  }
  if (options.layer) {
    where.push("dc.layer = ?");
    values.push(options.layer);
  }

  const result = await env.DB.prepare(
    `
    select
      dc.id,
      dc.cell_code,
      dc.layer,
      dc.density,
      ds.snapshot_date,
      dc.geometry_geojson,
      dc.geometry_r2_key
    from distribution_cells dc
    join distribution_snapshots ds on ds.id = dc.snapshot_id
    where ${where.join(" and ")}
    order by dc.cell_code asc
    limit ?
    `
  )
    .bind(...values, featureLimit + 1)
    .all<DistributionRow>();

  const rows = result.results ?? [];
  const truncated = rows.length > featureLimit;
  const features: Array<GeoJsonFeature<DistributionFeatureProperties>> = [];
  for (const row of rows.slice(0, featureLimit)) {
    features.push({
      type: "Feature",
      id: row.id,
      geometry: await loadGeometry(env, row.geometry_geojson, row.geometry_r2_key),
      properties: {
        cell_code: row.cell_code,
        layer: row.layer,
        density: row.density,
        snapshot_date: row.snapshot_date
      }
    });
  }

  return {
    type: "FeatureCollection" as const,
    features,
    meta: {
      truncated,
      limit: featureLimit,
      requested_zoom: options.zoom
    }
  };
}

export async function getHabitats(
  env: Env,
  bbox: BBox | null,
  level: string | null
): Promise<CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>> {
  const where: string[] = ["1=1"];
  const values: unknown[] = [];

  if (level) {
    where.push("h.level = ?");
    values.push(level);
  }
  if (bbox) {
    where.push("not (h.max_lng < ? or h.min_lng > ? or h.max_lat < ? or h.min_lat > ?)");
    values.push(bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat);
  }

  const result = await env.DB.prepare(
    `
    select
      h.id,
      h.name,
      h.province,
      h.level,
      h.boundary_geojson,
      h.boundary_r2_key
    from habitats h
    where ${where.join(" and ")}
    order by h.name asc
    limit ?
    `
  )
    .bind(...values, HABITAT_FEATURE_LIMIT + 1)
    .all<HabitatRow>();

  const rows = result.results ?? [];
  const truncated = rows.length > HABITAT_FEATURE_LIMIT;
  const features: Array<GeoJsonFeature<HabitatFeatureProperties>> = [];
  for (const row of rows.slice(0, HABITAT_FEATURE_LIMIT)) {
    features.push({
      type: "Feature",
      id: row.id,
      geometry: await loadGeometry(env, row.boundary_geojson, row.boundary_r2_key),
      properties: {
        name: row.name,
        province: row.province,
        level: row.level
      }
    });
  }

  return {
    type: "FeatureCollection" as const,
    features,
    meta: {
      truncated,
      limit: HABITAT_FEATURE_LIMIT,
      requested_zoom: null
    }
  };
}

export async function listDistributionSnapshots(env: Env, limit: number) {
  const result = await env.DB.prepare(
    `
    select snapshot_date, version, notes
    from distribution_snapshots
    order by snapshot_date desc, created_at desc
    limit ?
    `
  )
    .bind(limit)
    .all<{ snapshot_date: string; version: string; notes: string | null }>();

  return { items: result.results ?? [] };
}
