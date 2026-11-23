export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const ZOOM = { min: 1, max: 4, doubleTap: 2.5 } as const;

/** The page a horizontal pager rests on at this offset, for pages one `width` wide. */
export function pageAt(offset: number, width: number, count: number): number {
  "worklet";
  if (width <= 0 || count <= 0) return 0;
  return Math.min(Math.max(Math.round(offset / width), 0), count - 1);
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

/**
 * Past a bound the value moves less the further it goes, the way iOS scroll views stretch: it never
 * passes `dimension` beyond the bound, however far the finger goes.
 */
export function rubberBand(value: number, min: number, max: number, dimension: number): number {
  "worklet";
  const stretch = (over: number) => (1 - 1 / ((over * 0.55) / dimension + 1)) * dimension;
  if (value > max) return max + stretch(value - max);
  if (value < min) return min - stretch(min - value);
  return value;
}

/** How big the image draws inside the viewport with contentFit "contain". Unknown sizes fill it. */
export function fittedSize(viewport: Size, image: Size | null): Size {
  "worklet";
  if (!image || image.width <= 0 || image.height <= 0) return viewport;
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * fit, height: image.height * fit };
}

/** How far a zoomed image can pan from centre before its edge leaves the viewport's edge. */
export function panLimit(scale: number, viewport: Size, content: Size): Point {
  "worklet";
  return {
    x: Math.max(0, (content.width * scale - viewport.width) / 2),
    y: Math.max(0, (content.height * scale - viewport.height) / 2),
  };
}

/**
 * The translation that keeps the image point under `focal` there at `scale`, given the point it was
 * under at `fromScale` and `fromTranslation`. Points are measured from the viewport's centre, the
 * transform origin.
 */
export function anchoredTranslation(focal: Point, fromFocal: Point, fromScale: number, fromTranslation: Point, scale: number): Point {
  "worklet";
  const ratio = scale / fromScale;
  return {
    x: focal.x - (fromFocal.x - fromTranslation.x) * ratio,
    y: focal.y - (fromFocal.y - fromTranslation.y) * ratio,
  };
}

/** Where a double tap at `tap` lands: zoomed to ZOOM.doubleTap around it, kept inside the edges. */
export function doubleTapTarget(tap: Point, viewport: Size, content: Size): Point & { scale: number } {
  "worklet";
  const scale = ZOOM.doubleTap;
  const limit = panLimit(scale, viewport, content);
  const anchored = anchoredTranslation(tap, tap, 1, { x: 0, y: 0 }, scale);
  return { scale, x: clamp(anchored.x, -limit.x, limit.x), y: clamp(anchored.y, -limit.y, limit.y) };
}
