import { CACHED_HABITAT_PUBLIC_RELEASE } from "@/features/map/cached-habitat-release";
import type {
  CompleteGeoJsonFeatureCollection,
  HabitatFeatureProperties,
} from "@/lib/types";

const DEFAULT_BBOX = "100,25,110,36";

export interface HabitatQueryOptions {
  bbox?: string;
  level?: string;
}

export interface HabitatMapInput {
  collection: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>;
  source: "cached-release";
  snapshotDate: string;
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

export async function loadHabitatMapInput(
  options: HabitatQueryOptions = {},
): Promise<HabitatMapInput> {
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
