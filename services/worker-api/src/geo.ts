import type { Env } from "./bindings";
import { HttpError } from "./http";
import type { GeoJsonGeometry } from "./types";

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function parseBBox(raw: string | null, required: boolean): BBox | null {
  if (!raw) {
    if (required) {
      throw new HttpError(422, "bbox is required");
    }
    return null;
  }

  const parts = raw.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    throw new HttpError(422, "bbox must contain 4 comma-separated numbers");
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new HttpError(422, "bbox min values must be smaller than max values");
  }
  return { minLng, minLat, maxLng, maxLat };
}

export function parseJsonObject<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadGeometry(
  env: Env,
  inlineGeoJson: string | null,
  r2Key: string | null
): Promise<GeoJsonGeometry> {
  if (inlineGeoJson) {
    return parseJsonObject<GeoJsonGeometry>(inlineGeoJson, {
      type: "MultiPolygon",
      coordinates: []
    });
  }

  if (r2Key && env.GEO_BUCKET) {
    const object = await env.GEO_BUCKET.get(r2Key);
    if (object) {
      return object.json<GeoJsonGeometry>();
    }
  }

  return { type: "MultiPolygon", coordinates: [] };
}
