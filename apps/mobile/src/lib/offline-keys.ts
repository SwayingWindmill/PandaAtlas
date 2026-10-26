// Which public reads the app keeps on the device for use without a connection, and under which key. The
// release-wide lists are kept whole; single pages (a panda, an institution) only for the ones opened lately.

const LISTS = new Set([
  "/api/v2/pandas",
  "/api/v2/residencies",
  "/api/v2/places",
  "/api/v2/lineage",
  "/api/v2/life-events",
  "/api/v2/institutions",
  "/api/v2/updates",
]);
const PAGE = /^\/api\/v2\/(pandas|institutions)\/[^/]+$/;

export const PAGES_KEPT = 30;

export interface OfflineEntry {
  key: string;
  /** A single page, counted against PAGES_KEPT. */
  page: boolean;
}

export function offlineEntry(url: string): OfflineEntry | null {
  const { pathname, search } = new URL(url);
  if (LISTS.has(pathname)) return { key: `offline:${pathname}${search}`, page: false };
  if (PAGE.test(pathname)) return { key: `offline:${pathname}`, page: true };
  return null;
}

/** The kept pages after opening `key`: newest first, and the ones that fall off the end to delete. */
export function keepRecent(pages: string[], key: string, limit = PAGES_KEPT): { pages: string[]; drop: string[] } {
  const next = [key, ...pages.filter((page) => page !== key)];
  return { pages: next.slice(0, limit), drop: next.slice(limit) };
}
