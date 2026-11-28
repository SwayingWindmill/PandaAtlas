/** Intentionally does not start with `offline:` so `clearOfflineCache()` never erases user diary photos. */
export const VISIT_PHOTOS_KEY = "visit-photos:v1";
export const MAX_VISIT_PHOTOS = 4;
export const VISIT_PHOTO_MAX_WIDTH = 1200;
export const VISIT_PHOTO_COMPRESS = 0.8;
export const GUEST_PHOTO_SCOPE = "guest";

export interface LocalVisitPhoto {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export type VisitPhotoMap = Record<string, LocalVisitPhoto[]>;

export type PhotoCollageLayout = "none" | "single" | "pair" | "triple" | "quad";

export function photoScopeFor(accountId: string | null | undefined): string {
  return accountId && accountId.trim().length > 0 ? accountId : GUEST_PHOTO_SCOPE;
}

export function visitPhotoKey(scope: string, placeId: string, visitedOn: string): string {
  return `${scope}:${placeId}:${visitedOn}`;
}

function normalizePhoto(item: unknown): LocalVisitPhoto | null {
  if (!item || typeof item !== "object") return null;
  const candidate = item as Record<string, unknown>;
  if (typeof candidate.id !== "string" || typeof candidate.uri !== "string" || candidate.uri.length === 0) {
    return null;
  }
  const width =
    typeof candidate.width === "number" && Number.isFinite(candidate.width) && candidate.width > 0
      ? Math.round(candidate.width)
      : undefined;
  const height =
    typeof candidate.height === "number" && Number.isFinite(candidate.height) && candidate.height > 0
      ? Math.round(candidate.height)
      : undefined;
  const createdAt =
    typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
      ? candidate.createdAt
      : "1970-01-01T00:00:00.000Z";
  return {
    id: candidate.id,
    uri: candidate.uri,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    createdAt,
  };
}

function dedupePhotos(photos: readonly LocalVisitPhoto[]): LocalVisitPhoto[] {
  const seenIds = new Set<string>();
  const out: LocalVisitPhoto[] = [];
  for (const photo of photos) {
    if (seenIds.has(photo.id) || !photo.uri) continue;
    seenIds.add(photo.id);
    out.push(photo);
    if (out.length >= MAX_VISIT_PHOTOS) break;
  }
  return out;
}

export function parseVisitPhotoMap(raw: string | null): VisitPhotoMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: VisitPhotoMap = {};
    for (const [key, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      const valid = dedupePhotos(list.map(normalizePhoto).filter((item): item is LocalVisitPhoto => item !== null));
      if (valid.length > 0) out[key] = valid;
    }
    return out;
  } catch {
    return {};
  }
}

export function getVisitPhotos(
  map: VisitPhotoMap,
  scope: string,
  placeId: string,
  visitedOn: string,
): LocalVisitPhoto[] {
  return map[visitPhotoKey(scope, placeId, visitedOn)] ?? [];
}

function unreferencedRemoved(
  removed: readonly LocalVisitPhoto[],
  nextMap: VisitPhotoMap,
): LocalVisitPhoto[] {
  if (removed.length === 0) return [];
  const stillReferenced = new Set<string>();
  for (const items of Object.values(nextMap)) {
    for (const item of items) stillReferenced.add(item.uri);
  }
  return removed.filter((item) => !stillReferenced.has(item.uri));
}

/** Replaces the photo list for one key and reports displaced photos whose URIs are no longer referenced anywhere. */
export function setVisitPhotosInMap(
  map: VisitPhotoMap,
  key: string,
  photos: readonly LocalVisitPhoto[],
): { next: VisitPhotoMap; dropped: LocalVisitPhoto[] } {
  const previous = map[key] ?? [];
  const normalized = dedupePhotos(photos);
  const next: VisitPhotoMap = { ...map };
  if (normalized.length > 0) {
    next[key] = normalized;
  } else {
    delete next[key];
  }
  const keptUris = new Set(normalized.map((item) => item.uri));
  const displaced = previous.filter((item) => !keptUris.has(item.uri));
  return {
    next,
    dropped: unreferencedRemoved(displaced, next),
  };
}

/** Deletes one key's photo entry and reports removed photos whose URIs are unreferenced elsewhere. */
export function removeVisitPhotosInMap(
  map: VisitPhotoMap,
  key: string,
): { next: VisitPhotoMap; removed: LocalVisitPhoto[] } {
  const previous = map[key] ?? [];
  if (!(key in map)) return { next: map, removed: [] };
  const next: VisitPhotoMap = { ...map };
  delete next[key];
  return {
    next,
    removed: unreferencedRemoved(previous, next),
  };
}

/** Merges synced guest check-in photo entries into the signed-in account scope without clobbering existing photos. */
export function migrateGuestVisitPhotosInMap(
  map: VisitPhotoMap,
  accountId: string,
  visits: readonly { placeId: string; visitedOn: string }[],
): { next: VisitPhotoMap; changed: boolean } {
  if (!accountId || visits.length === 0) return { next: map, changed: false };
  const next: VisitPhotoMap = { ...map };
  let changed = false;

  for (const visit of visits) {
    const guestKey = visitPhotoKey(GUEST_PHOTO_SCOPE, visit.placeId, visit.visitedOn);
    const guestPhotos = next[guestKey];
    if (!guestPhotos || guestPhotos.length === 0) continue;
    const accountKey = visitPhotoKey(accountId, visit.placeId, visit.visitedOn);
    const existing = next[accountKey] ?? [];
    next[accountKey] = dedupePhotos([...existing, ...guestPhotos]);
    delete next[guestKey];
    changed = true;
  }

  return { next: changed ? next : map, changed };
}

/** Scales down oversized images to `VISIT_PHOTO_MAX_WIDTH` without upscaling smaller sources. */
export function computeResizeWidth(width?: number): number | null {
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return null;
  return width > VISIT_PHOTO_MAX_WIDTH ? VISIT_PHOTO_MAX_WIDTH : null;
}

export function collageLayoutForCount(count: number): PhotoCollageLayout {
  if (count <= 0) return "none";
  if (count === 1) return "single";
  if (count === 2) return "pair";
  if (count === 3) return "triple";
  return "quad";
}

export function ticketFilename(slug: string, visitedOn: string): string {
  const safeSlug = slug.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "panda";
  const safeDate = visitedOn.replace(/[^0-9-]+/g, "") || "today";
  return `zhipanda-ticket-${safeSlug}-${safeDate}.png`;
}
