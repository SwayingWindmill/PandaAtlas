import type { Photo } from "@/features/pandas/profile";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** `zoomed` sits just above 1x so float noise after a pinch never counts as zoomed and locks the pager. */
export const ZOOM = { min: 1, max: 4, doubleTap: 2.5, zoomed: 1.01 } as const;

export function pageAt(offset: number, width: number, count: number): number {
  "worklet";
  if (width <= 0 || count <= 0) return 0;
  return Math.min(Math.max(Math.round(offset / width), 0), count - 1);
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

export function restingScale(scale: number): number {
  "worklet";
  return scale <= ZOOM.zoomed ? ZOOM.min : clamp(scale, ZOOM.min, ZOOM.max);
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

export function fittedSize(viewport: Size, image: Size | null): Size {
  "worklet";
  if (!image || image.width <= 0 || image.height <= 0) return viewport;
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * fit, height: image.height * fit };
}

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

export function doubleTapTarget(tap: Point, viewport: Size, content: Size): Point & { scale: number } {
  "worklet";
  const scale = ZOOM.doubleTap;
  const limit = panLimit(scale, viewport, content);
  const anchored = anchoredTranslation(tap, tap, 1, { x: 0, y: 0 }, scale);
  return { scale, x: clamp(anchored.x, -limit.x, limit.x), y: clamp(anchored.y, -limit.y, limit.y) };
}

export function shareText(photo: Photo, name: string): string {
  return [name, photo.credit].filter(Boolean).join("\n");
}

// File systems cap a name at 255 bytes, not characters, and a CJK character takes three.
const MAX_STEM_BYTES = 200;

function utf8Length(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  return codePoint < 0x10000 ? 3 : 4;
}

/**
 * Names the file after the panda and the credit. Android's share sheet carries no text with a file,
 * so the file name is the only place the credit travels there. `#` and `%` would break its file URI.
 */
export function fileName(photo: Photo, name: string): string {
  const extension = /\.(jpe?g|png|webp|heic|gif)(?:$|[?#])/i.exec(photo.url)?.[1]?.toLowerCase() ?? "jpg";
  const words = [name, photo.credit]
    .filter(Boolean)
    .join(" ")
    .replace(/[\\/:*?"<>|#%\u0000-\u001f\s]+/g, " ")
    .trim();
  let stem = "";
  let bytes = 0;
  for (const char of words) {
    bytes += utf8Length(char);
    if (bytes > MAX_STEM_BYTES) break;
    stem += char;
  }
  return `${stem.trim() || photo.id}.${extension}`;
}
