import { CACHED_HABITAT_PUBLIC_RELEASE } from "@/features/map/cached-habitat-release";
import type {
  CompleteGeoJsonFeatureCollection,
  HabitatFeatureProperties,
  OverviewStats,
} from "@/lib/types";

const DEFAULT_BBOX = "100,25,110,36";

export interface HabitatQueryOptions {
  bbox?: string;
  level?: string;
}

export interface HabitatMapInput {
  collection: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>;
  source: "api" | "cached-release";
  snapshotDate: string;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Public API request failed with ${response.status}`);
  return (await response.json()) as T;
}

type ParsedBBox = [number, number, number, number];

function parseBBox(value: string): ParsedBBox | null {
  const values = value.split(",").map((item) => Number(item.trim()));
  if (
    values.length !== 4 ||
    values.some((item) => !Number.isFinite(item)) ||
    values[0] >= values[2] ||
    values[1] >= values[3]
  ) {
    return null;
  }
  return values as ParsedBBox;
}

function collectGeometryPositions(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  ) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(collectGeometryPositions);
}

function geometryIntersectsBBox(coordinates: unknown, bbox: ParsedBBox | null): boolean {
  if (!bbox) return true;
  const positions = collectGeometryPositions(coordinates);
  if (positions.length === 0) return false;
  const longitudes = positions.map(([longitude]) => longitude);
  const latitudes = positions.map(([, latitude]) => latitude);
  return !(
    Math.max(...longitudes) < bbox[0] ||
    Math.min(...longitudes) > bbox[2] ||
    Math.max(...latitudes) < bbox[1] ||
    Math.min(...latitudes) > bbox[3]
  );
}

function cachedHabitatInput(options: HabitatQueryOptions): HabitatMapInput {
  const bbox = parseBBox(options.bbox ?? DEFAULT_BBOX);
  return {
    collection: {
      ...CACHED_HABITAT_PUBLIC_RELEASE.data,
      features: CACHED_HABITAT_PUBLIC_RELEASE.data.features.filter(
        (feature) =>
          geometryIntersectsBBox(feature.geometry.coordinates, bbox) &&
          (!options.level || feature.properties.level === options.level),
      ),
    },
    source: "cached-release",
    snapshotDate: CACHED_HABITAT_PUBLIC_RELEASE.snapshotDate,
  };
}

export async function loadHabitatMapInput(
  options: HabitatQueryOptions = {},
): Promise<HabitatMapInput> {
  const query = buildQuery({
    bbox: options.bbox ?? DEFAULT_BBOX,
    level: options.level,
  });

  try {
    const [collection, overview] = await Promise.all([
      fetchJson<CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>>(
        `/api/v1/map/habitats?${query}`,
      ),
      fetchJson<OverviewStats>("/api/v1/stats/overview"),
    ]);
    return {
      collection,
      source: "api",
      snapshotDate: overview.latest_snapshot_date,
    };
  } catch {
    return cachedHabitatInput(options);
  }
}
