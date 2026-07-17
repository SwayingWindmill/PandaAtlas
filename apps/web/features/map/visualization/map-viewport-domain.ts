import type { StructuredMapMode } from "@/features/map/map-query";

export interface MapViewportState {
  longitude: number;
  latitude: number;
  zoom: number;
}

const DEFAULT_VIEWPORTS: Record<StructuredMapMode, MapViewportState> = {
  institutions: { longitude: 17, latitude: 32, zoom: 2.15 },
  individual: { longitude: 17, latitude: 32, zoom: 2.15 },
  wild: { longitude: 104.2, latitude: 31.1, zoom: 5.1 },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

export function defaultMapViewport(mode: StructuredMapMode): MapViewportState {
  return { ...DEFAULT_VIEWPORTS[mode] };
}

export function canonicalMapViewport(viewport: MapViewportState): MapViewportState {
  return {
    longitude: rounded(clamp(viewport.longitude, -180, 180), 4),
    latitude: rounded(clamp(viewport.latitude, -85, 85), 4),
    zoom: rounded(clamp(viewport.zoom, 2, 12), 2),
  };
}

export function parseMapViewport(value: string, mode: StructuredMapMode): MapViewportState {
  if (!value) return defaultMapViewport(mode);
  const parts = value.split(",").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return defaultMapViewport(mode);
  }
  return canonicalMapViewport({ longitude: parts[0], latitude: parts[1], zoom: parts[2] });
}

export function serializeMapViewport(viewport: MapViewportState): string {
  const canonical = canonicalMapViewport(viewport);
  return `${canonical.longitude},${canonical.latitude},${canonical.zoom}`;
}

export function canonicalMapViewportValue(value: string, mode: StructuredMapMode): string {
  if (!value) return "";
  return serializeMapViewport(parseMapViewport(value, mode));
}
