import { WORLD_HEIGHT, WORLD_WIDTH } from "@zhipanda/world-map";

/** Where the map looks: the outline point at the centre of the visible area, and pixels per outline unit. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

/** The screen the map draws into, and the strips the top buttons and the bottom sheet cover. */
export interface Viewport {
  width: number;
  height: number;
  top: number;
  bottom: number;
}

/** From the whole world on a phone to a few kilometres; the 110m outline has nothing finer to show. */
const MAX_SCALE = 60;

export function minScale(viewport: Viewport): number {
  return viewport.width / WORLD_WIDTH;
}

export function clampScale(scale: number, viewport: Viewport): number {
  return Math.min(MAX_SCALE, Math.max(minScale(viewport), scale));
}

/** The centre of the strip between the top buttons and the sheet. */
function focus(viewport: Viewport): Point {
  return { x: viewport.width / 2, y: viewport.top + (viewport.height - viewport.top - viewport.bottom) / 2 };
}

export function toScreen(point: Point, camera: Camera, viewport: Viewport): Point {
  const centre = focus(viewport);
  return { x: centre.x + (point.x - camera.x) * camera.scale, y: centre.y + (point.y - camera.y) * camera.scale };
}

export function toWorld(point: Point, camera: Camera, viewport: Viewport): Point {
  const centre = focus(viewport);
  return { x: camera.x + (point.x - centre.x) / camera.scale, y: camera.y + (point.y - centre.y) / camera.scale };
}

/** The SVG viewBox that shows the outline as the camera sees it, over the whole viewport. */
export function viewBox(camera: Camera, viewport: Viewport): string {
  const origin = toWorld({ x: 0, y: 0 }, camera, viewport);
  return `${origin.x} ${origin.y} ${viewport.width / camera.scale} ${viewport.height / camera.scale}`;
}

/** The camera never leaves the outline, so a drag cannot lose the map off screen. */
export function clampCamera(camera: Camera, viewport: Viewport): Camera {
  const scale = clampScale(camera.scale, viewport);
  const halfWidth = viewport.width / 2 / scale;
  const x = halfWidth * 2 >= WORLD_WIDTH ? WORLD_WIDTH / 2 : Math.min(WORLD_WIDTH - halfWidth, Math.max(halfWidth, camera.x));
  const y = Math.min(WORLD_HEIGHT, Math.max(0, camera.y));
  return { x, y, scale };
}

/** Moves the map with a finger: the outline follows the drag. */
export function panBy(camera: Camera, dx: number, dy: number, viewport: Viewport): Camera {
  return clampCamera({ ...camera, x: camera.x - dx / camera.scale, y: camera.y - dy / camera.scale }, viewport);
}

/** Zooms by `factor` and keeps the outline point under `anchor` (a screen point) where it was. */
export function zoomAt(camera: Camera, factor: number, anchor: Point, viewport: Viewport): Camera {
  const scale = clampScale(camera.scale * factor, viewport);
  const under = toWorld(anchor, camera, viewport);
  const centre = focus(viewport);
  return clampCamera(
    { x: under.x - (anchor.x - centre.x) / scale, y: under.y - (anchor.y - centre.y) / scale, scale },
    viewport,
  );
}

/**
 * The camera that shows every point inside the visible strip, with `margin` pixels to spare.
 * `minSpan` (outline units) keeps one or two points from zooming in to street level.
 */
export function fitPoints(points: readonly Point[], viewport: Viewport, margin = 48, minSpan = 24): Camera {
  if (points.length === 0) return clampCamera({ x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, scale: 0 }, viewport);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = Math.max(right - left, minSpan);
  const height = Math.max(bottom - top, minSpan * 0.6);
  const usableWidth = Math.max(1, viewport.width - margin * 2);
  const usableHeight = Math.max(1, viewport.height - viewport.top - viewport.bottom - margin * 2);
  const scale = Math.min(usableWidth / width, usableHeight / height);
  return clampCamera({ x: (left + right) / 2, y: (top + bottom) / 2, scale }, viewport);
}

/** A step of a flight from one camera to another, `t` from 0 to 1. Zoom eases in log space so it feels even. */
export function between(from: Camera, to: Camera, t: number): Camera {
  const eased = 1 - Math.pow(1 - t, 3);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * eased),
  };
}
