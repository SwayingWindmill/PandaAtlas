import { normalizeTerm } from "@/features/pandas/pandas";
import { createStoredPref } from "@/lib/stored-pref";

// What a fan looked at and searched for lately, kept on this device: no account, no sync.

const MAX_VIEWS = 10;
const MAX_SEARCHES = 8;

function parseList(stored: string | null): string[] {
  try {
    const value: unknown = JSON.parse(stored ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const options = (key: string) => ({ key, parse: parseList, serialize: (list: string[]) => JSON.stringify(list) });

const views = createStoredPref<string[]>(options("recentPandaViews"));
const searches = createStoredPref<string[]>(options("recentPandaSearches"));

/** Most recent first, one entry per slug. */
export function withView(slugs: readonly string[], slug: string): string[] {
  return [slug, ...slugs.filter((item) => item !== slug)].slice(0, MAX_VIEWS);
}

/** Most recent first, one entry per normalized query ("Fu Bao" and "fubao" are the same search). */
export function withSearch(queries: readonly string[], query: string): string[] {
  const text = query.trim();
  const key = normalizeTerm(text);
  return [text, ...queries.filter((item) => normalizeTerm(item) !== key)].slice(0, MAX_SEARCHES);
}

export async function recordView(slug: string): Promise<void> {
  views.set(withView(await views.read(), slug));
}

export async function recordSearch(query: string): Promise<void> {
  if (!normalizeTerm(query)) return;
  searches.set(withSearch(await searches.read(), query));
}

export const clearRecentViews = () => views.set([]);
export const clearRecentSearches = () => searches.set([]);

/** Null until the device storage is read. */
export const useRecentViews = views.useValue;
export const useRecentSearches = searches.useValue;
