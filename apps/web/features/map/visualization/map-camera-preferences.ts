import type { Map as MapLibreMap } from "maplibre-gl";
import type { MapViewportState } from "@/features/map/visualization/map-viewport-domain";

export function prefersReducedMapMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function applyMapViewport(
  map: MapLibreMap,
  viewport: MapViewportState,
  options: { animate?: boolean } = {},
): void {
  const animate = options.animate !== false && !prefersReducedMapMotion();
  if (!animate) {
    map.jumpTo({ center: [viewport.longitude, viewport.latitude], zoom: viewport.zoom });
    return;
  }
  map.easeTo({
    center: [viewport.longitude, viewport.latitude],
    zoom: viewport.zoom,
    duration: 480,
    essential: false,
  });
}
