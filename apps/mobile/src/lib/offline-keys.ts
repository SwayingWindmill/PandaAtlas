// Which public reads the app keeps on the device for use without a connection, and under which key. The
// release-wide lists are kept whole; single pages (a panda, an institution) only for the ones opened lately,
// except pages pinned by a downloaded single-base offline pack.

export const OFFLINE_PREFIX = "offline:";
export const OFFLINE_PAGES_KEY = `${OFFLINE_PREFIX}pages`;
export const OFFLINE_PACKS_KEY = `${OFFLINE_PREFIX}packs:v1`;
export const OFFLINE_COVERS_KEY = `${OFFLINE_PREFIX}covers:v1`;

const LISTS = new Set([
  "/api/v2/pandas",
  "/api/v2/residencies",
  "/api/v2/places",
  "/api/v2/lineage",
  "/api/v2/life-events",
  "/api/v2/institutions",
  "/api/v2/updates",
  "/api/v2/learning",
  "/api/v2/venue-news",
  "/api/v2/comparisons",
  "/api/v2/news",
]);
const PAGE = /^\/api\/v2\/(pandas|institutions)\/[^/]+$/;

export const PAGES_KEPT = 30;

export interface OfflineEntry {
  key: string;
  /** A single page, counted against PAGES_KEPT unless pinned by a downloaded base pack. */
  page: boolean;
}

export function offlineEntry(url: string): OfflineEntry | null {
  const { pathname, search } = new URL(url);
  if (LISTS.has(pathname)) return { key: `${OFFLINE_PREFIX}${pathname}${search}`, page: false };
  if (PAGE.test(pathname)) return { key: `${OFFLINE_PREFIX}${pathname}`, page: true };
  return null;
}

/** The kept pages after opening `key`: newest first, while pinned base-pack pages never enter LRU eviction. */
export function keepRecent(
  pages: string[],
  key: string,
  limit = PAGES_KEPT,
  pinned?: ReadonlySet<string>,
): { pages: string[]; drop: string[] } {
  const unpinned = pages.filter((page) => page !== key && !pinned?.has(page));
  if (pinned?.has(key)) {
    return { pages: unpinned.slice(0, limit), drop: unpinned.slice(limit) };
  }
  const next = [key, ...unpinned];
  return { pages: next.slice(0, limit), drop: next.slice(limit) };
}
