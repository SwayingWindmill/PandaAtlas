export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const DOUBLE_TAP_ZOOM = 2.2;
export const ZOOM_SETTLE_THRESHOLD = 1.05;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

export function clampPan(offset: number, scale: number, viewport: number): number {
  if (!Number.isFinite(offset) || !Number.isFinite(scale) || !Number.isFinite(viewport) || scale <= MIN_ZOOM || viewport <= 0) {
    return 0;
  }
  const maxOffset = ((scale - 1) * viewport) / 2;
  return Math.max(-maxOffset, Math.min(maxOffset, offset));
}

export function parsePhotoIndex(raw: string | string[] | undefined, total: number): number {
  if (total <= 1) return 0;
  const text = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(text ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, total - 1);
}

export function touchDistance(
  a: { pageX: number; pageY: number },
  b: { pageX: number; pageY: number },
): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}
