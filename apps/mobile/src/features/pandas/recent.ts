import { normalizeTerm } from "@/features/pandas/pandas";
import { createStoredPref } from "@/lib/stored-pref";

// What a fan looked at and searched for lately, kept on this device: no account, no sync.

const MAX_VIEWS = 10;
const MAX_SEARCHES = 8;
const MAX_ID_LENGTH = 64;
const MAX_QUERY_LENGTH = 32;

/** Stored text is untrusted: keep non-empty strings once each, cut to length, newest first up to max. */
export function parseList(max: number, length: number) {
  return (stored: string | null): string[] => {
    try {
      const value: unknown = JSON.parse(stored ?? "[]");
      if (!Array.isArray(value)) return [];
      const texts = value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim().slice(0, length)] : []));
      return [...new Set(texts)].slice(0, max);
    } catch {
      return [];
    }
  };
}

const options = (key: string, max: number, length: number) => ({
  key,
  parse: parseList(max, length),
  serialize: (list: string[]) => JSON.stringify(list),
});

const views = createStoredPref<string[]>(options("recentPandaViews", MAX_VIEWS, MAX_ID_LENGTH));
const searches = createStoredPref<string[]>(options("recentPandaSearches", MAX_SEARCHES, MAX_QUERY_LENGTH));

/** One change at a time per store: two quick calls would otherwise both read the old list and drop one. */
function serialized(store: typeof views) {
  let queue: Promise<void> = Promise.resolve();
  return (change: (list: string[]) => string[]) => {
    queue = queue.then(async () => store.set(change(await store.read())));
    return queue;
  };
}

const updateViews = serialized(views);
const updateSearches = serialized(searches);

/** Most recent first, one entry per panda id. */
export function withView(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((item) => item !== id)].slice(0, MAX_VIEWS);
}

/** Most recent first, one entry per normalized query ("Fu Bao" and "fubao" are the same search). */
export function withSearch(queries: readonly string[], query: string): string[] {
  const text = query.trim().slice(0, MAX_QUERY_LENGTH);
  const key = normalizeTerm(text);
  return [text, ...queries.filter((item) => normalizeTerm(item) !== key)].slice(0, MAX_SEARCHES);
}

export function recordView(pandaId: string): Promise<void> {
  return updateViews((ids) => withView(ids, pandaId));
}

export function recordSearch(query: string): Promise<void> {
  if (!normalizeTerm(query)) return Promise.resolve();
  return updateSearches((queries) => withSearch(queries, query));
}

export const clearRecentViews = () => views.set([]);
export const clearRecentSearches = () => searches.set([]);

/** Null until the device storage is read. */
export const useRecentViews = views.useValue;
export const useRecentSearches = searches.useValue;
