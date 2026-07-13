export interface MapViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface MapViewport {
  bbox: [number, number, number, number];
  zoom: number;
}

const COORDINATE_PRECISION = 5;

function roundCoordinate(value: number): number {
  const rounded = Number(value.toFixed(COORDINATE_PRECISION));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function createMapViewport(bounds: MapViewportBounds, zoom: number): MapViewport {
  const values = [bounds.west, bounds.south, bounds.east, bounds.north, zoom];
  if (!values.every(Number.isFinite) || bounds.west >= bounds.east || bounds.south >= bounds.north) {
    throw new Error("Map viewport must contain valid map bounds and zoom");
  }

  const bbox: MapViewport["bbox"] = [
    roundCoordinate(bounds.west),
    roundCoordinate(bounds.south),
    roundCoordinate(bounds.east),
    roundCoordinate(bounds.north),
  ];
  if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
    throw new Error("Map viewport must contain valid map bounds and zoom");
  }

  return {
    bbox,
    zoom: Math.min(22, Math.max(0, Math.floor(zoom))),
  };
}

export function mapViewportEquals(left: MapViewport | null, right: MapViewport | null): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.zoom !== right.zoom) {
    return false;
  }
  return left.bbox.every((value, index) => value === right.bbox[index]);
}

export function mapViewportToQuery(viewport: MapViewport): { bbox: string; zoom: number } {
  return {
    bbox: viewport.bbox.join(","),
    zoom: viewport.zoom,
  };
}
