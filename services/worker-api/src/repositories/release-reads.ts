import type { BBox } from "../geo";
import { HttpError } from "../http";
import type {
  CompleteGeoJsonFeatureCollection,
  DistributionFeatureProperties,
  DistributionSnapshot,
  GeoJsonFeature,
  HabitatFeatureProperties,
  OverviewStats,
  PandaDetail,
  PandaLineageNode,
  PandaListItem,
} from "../types";
import type { Env } from "../bindings";
import {
  buildLineageRelationships,
  type LineageOptions,
  type PandaListOptions,
} from "./pandas";

async function payloads<T>(
  env: Env,
  version: string,
  entityType: string,
): Promise<T[]> {
  const result = await env.DB.prepare(
    `
    select record.public_json
    from public_release_records record
    where record.dataset_release_version = ? and record.entity_type = ?
      and not exists (
        select 1 from public_release_withdrawals withdrawal
        where withdrawal.dataset_release_version = record.dataset_release_version
          and (
            (withdrawal.entity_type is null and withdrawal.entity_id is null)
            or ((withdrawal.entity_type = record.entity_type
                 or (record.entity_type = 'api_pandas' and withdrawal.entity_type = 'pandas'))
                and withdrawal.entity_id = record.entity_id)
          )
      )
    order by record.entity_id
  `,
  )
    .bind(version, entityType)
    .all<{ public_json: string }>();
  return (result.results ?? []).map((row) => JSON.parse(row.public_json) as T);
}

function matchesReference(panda: PandaDetail, reference: string): boolean {
  const normalized = reference.trim().toLocaleLowerCase();
  const values = [panda.id, panda.slug, panda.identity?.canonical_slug ?? ""];
  values.push(
    ...(panda.identity?.legacy_slugs ?? []).map((item) => item.value),
  );
  values.push(
    ...(panda.identity?.external_identifiers ?? []).flatMap((item) => [
      item.value,
      `${item.system}:${item.value}`,
    ]),
  );
  return values.some((value) => value.toLocaleLowerCase() === normalized);
}

export async function listReleasePandas(
  env: Env,
  version: string,
  options: PandaListOptions,
) {
  let rows = await payloads<PandaDetail>(env, version, "api_pandas");
  if (options.q) {
    const q = options.q.trim().toLocaleLowerCase();
    rows = rows.filter(
      (row) =>
        row.name_zh.toLocaleLowerCase().includes(q) ||
        (row.name_en ?? "").toLocaleLowerCase().includes(q) ||
        row.search_terms.some((term) => term.toLocaleLowerCase().includes(q)) ||
        matchesReference(row, options.q ?? ""),
    );
  }
  if (options.status)
    rows = rows.filter((row) => row.status === options.status);
  if (options.gender)
    rows = rows.filter((row) => row.gender === options.gender);
  if (options.habitatId) {
    rows = rows.filter((row) =>
      row.habitats.some((item) => item.id === options.habitatId),
    );
  }
  if (options.featured !== null) {
    rows = rows.filter(
      (row) => row.tags.includes("featured") === options.featured,
    );
  }
  rows.sort((left, right) => {
    if (options.sort === "name_asc")
      return left.name_zh.localeCompare(right.name_zh);
    if (options.sort === "name_desc")
      return right.name_zh.localeCompare(left.name_zh);
    if (options.sort === "birth_date_desc")
      return (right.birth_date ?? "").localeCompare(left.birth_date ?? "");
    return right.id.localeCompare(left.id);
  });
  const total = rows.length;
  const start = (options.page - 1) * options.pageSize;
  const items: PandaListItem[] = rows
    .slice(start, start + options.pageSize)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name_zh: row.name_zh,
      name_en: row.name_en,
      gender: row.gender,
      status: row.status,
      birth_date: row.birth_date,
      current_location: row.current_location,
      cover_image_url: row.cover_image_url,
      search_terms: row.search_terms,
    }));
  return {
    items,
    meta: { page: options.page, page_size: options.pageSize, total },
  };
}

export async function getReleasePanda(
  env: Env,
  version: string,
  reference: string,
) {
  const row = (await payloads<PandaDetail>(env, version, "api_pandas")).find(
    (item) => matchesReference(item, reference),
  );
  if (!row)
    throw new HttpError(404, "Panda not found in current public release");
  return row;
}

export async function getReleaseLineage(
  env: Env,
  version: string,
  reference: string,
  options: LineageOptions,
) {
  const rows = await payloads<PandaDetail>(env, version, "api_pandas");
  const focus = rows.find((item) => matchesReference(item, reference));
  if (!focus)
    throw new HttpError(404, "Panda not found in current public release");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string, Set<string>>();
  for (const row of rows)
    for (const parentId of [row.father_id, row.mother_id]) {
      if (parentId && byId.has(parentId)) {
        const values = children.get(parentId) ?? new Set<string>();
        values.add(row.id);
        children.set(parentId, values);
      }
    }
  const selected = new Set([focus.id]);
  const walk = (ancestors: boolean, limit: number) => {
    const queue: Array<[string, number]> = [[focus.id, 0]];
    while (queue.length) {
      const [id, depth] = queue.shift()!;
      if (depth >= limit) continue;
      const next = ancestors
        ? ([byId.get(id)?.father_id, byId.get(id)?.mother_id].filter(
            Boolean,
          ) as string[])
        : [...(children.get(id) ?? [])];
      for (const nextId of next)
        if (byId.has(nextId) && !selected.has(nextId)) {
          selected.add(nextId);
          queue.push([nextId, depth + 1]);
        }
    }
  };
  walk(true, options.ancestorDepth);
  walk(false, options.descendantDepth);
  for (const parentId of [focus.father_id, focus.mother_id])
    if (parentId && byId.has(parentId)) {
      selected.add(parentId);
      for (const sibling of children.get(parentId) ?? []) selected.add(sibling);
    }
  const nodes: PandaLineageNode[] = rows
    .filter((row) => selected.has(row.id))
    .map((row) => ({
      ...row,
      intro: row.intro,
      tags: row.tags,
      father_id: row.father_id,
      mother_id: row.mother_id,
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = nodes.flatMap((node) =>
    [node.father_id, node.mother_id]
      .filter((id): id is string => Boolean(id && nodeIds.has(id)))
      .map((parent_id) => ({ parent_id, child_id: node.id })),
  );
  return {
    focus_id: focus.id,
    nodes,
    edges,
    relationships: buildLineageRelationships(nodeIds, edges),
    meta: {
      ancestor_depth: options.ancestorDepth,
      descendant_depth: options.descendantDepth,
    },
  };
}

function positions(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(positions);
}

function intersects(
  feature: GeoJsonFeature<Record<string, unknown>>,
  bbox: BBox | null,
): boolean {
  if (!bbox) return true;
  const points = positions(feature.geometry.coordinates);
  if (!points.length) return false;
  const lng = points.map(([value]) => value);
  const lat = points.map(([, value]) => value);
  return !(
    Math.max(...lng) < bbox.minLng ||
    Math.min(...lng) > bbox.maxLng ||
    Math.max(...lat) < bbox.minLat ||
    Math.min(...lat) > bbox.maxLat
  );
}

export async function getReleaseDistribution(
  env: Env,
  version: string,
  options: {
    bbox: BBox;
    snapshotDate: string | null;
    layer: string | null;
    zoom: number | null;
  },
): Promise<CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>> {
  let features = await payloads<GeoJsonFeature<DistributionFeatureProperties>>(
    env,
    version,
    "api_distribution",
  );
  features = features.filter(
    (feature) =>
      intersects(feature, options.bbox) &&
      (!options.layer || feature.properties.layer === options.layer) &&
      (!options.snapshotDate ||
        feature.properties.snapshot_date === options.snapshotDate),
  );
  const limit =
    options.zoom === null
      ? 5000
      : options.zoom <= 4
        ? 1500
        : options.zoom <= 7
          ? 3000
          : 5000;
  return {
    type: "FeatureCollection",
    features: features.slice(0, limit),
    meta: {
      truncated: features.length > limit,
      limit,
      requested_zoom: options.zoom,
    },
  };
}

export async function getReleaseHabitats(
  env: Env,
  version: string,
  bbox: BBox | null,
  level: string | null,
) {
  let features = await payloads<GeoJsonFeature<HabitatFeatureProperties>>(
    env,
    version,
    "api_habitats",
  );
  features = features.filter(
    (feature) =>
      intersects(feature, bbox) &&
      (!level || feature.properties.level === level),
  );
  return {
    type: "FeatureCollection" as const,
    features: features.slice(0, 2000),
    meta: {
      truncated: features.length > 2000,
      limit: 2000,
      requested_zoom: null,
    },
  };
}

export async function listReleaseSnapshots(
  env: Env,
  version: string,
  limit: number,
) {
  const items = await payloads<DistributionSnapshot>(
    env,
    version,
    "api_snapshots",
  );
  items.sort((left, right) =>
    right.snapshot_date.localeCompare(left.snapshot_date),
  );
  return { items: items.slice(0, limit) };
}

export async function getReleaseStats(
  env: Env,
  version: string,
): Promise<OverviewStats> {
  const rows = await payloads<OverviewStats>(env, version, "api_stats");
  if (!rows[0])
    throw new HttpError(503, "Public API release snapshot unavailable");
  const [pandas, habitats, distribution, snapshots] = await Promise.all([
    payloads<PandaDetail>(env, version, "api_pandas"),
    payloads<GeoJsonFeature<HabitatFeatureProperties>>(
      env,
      version,
      "api_habitats",
    ),
    payloads<GeoJsonFeature<DistributionFeatureProperties>>(
      env,
      version,
      "api_distribution",
    ),
    payloads<DistributionSnapshot>(env, version, "api_snapshots"),
  ]);
  snapshots.sort((left, right) =>
    right.snapshot_date.localeCompare(left.snapshot_date),
  );
  const latest = snapshots[0]?.snapshot_date ?? rows[0].latest_snapshot_date;
  return {
    ...rows[0],
    total_pandas: pandas.length,
    featured_pandas: pandas.filter((item) => item.tags.includes("featured"))
      .length,
    active_habitats: habitats.length,
    latest_snapshot_date: latest,
    wild_distribution_cells: distribution.filter(
      (feature) =>
        feature.properties.layer === "wild" &&
        feature.properties.snapshot_date === latest,
    ).length,
  };
}
