import type { Env } from "../bindings";
import type { BBox } from "../geo";
import { loadGeometry } from "../geo";
import type {
  DistributionFeatureProperties,
  DistributionLayer,
  GeoJsonFeature,
  HabitatFeatureProperties
} from "../types";

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

export async function getDistribution(env: Env, options: DistributionOptions) {
  const snapshotDate =
    options.snapshotDate ??
    (
      await env.DB.prepare("select max(snapshot_date) as snapshot_date from distribution_snapshots").first<{
        snapshot_date: string | null;
      }>()
    )?.snapshot_date;

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
    limit 5000
    `
  )
    .bind(...values)
    .all<DistributionRow>();

  const features: Array<GeoJsonFeature<DistributionFeatureProperties>> = [];
  for (const row of result.results ?? []) {
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

  return { type: "FeatureCollection" as const, features };
}

export async function getHabitats(env: Env, bbox: BBox | null, level: string | null) {
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
    limit 2000
    `
  )
    .bind(...values)
    .all<HabitatRow>();

  const features: Array<GeoJsonFeature<HabitatFeatureProperties>> = [];
  for (const row of result.results ?? []) {
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

  return { type: "FeatureCollection" as const, features };
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
