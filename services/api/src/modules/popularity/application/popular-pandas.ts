// 大家常看 (v4 `02-find`): the pandas most fans began following in the last 30 days. Follows are the only
// popularity signal the app records; no view is tracked. A panda counts only when enough distinct fans
// followed it, so a handful of accounts cannot put one on the list and no single fan can be inferred.

export const POPULAR_WINDOW_DAYS = 30;
export const POPULAR_MIN_FOLLOWERS = 5;
export const POPULAR_LIMIT = 10;

export interface FollowCount {
  pandaId: string;
  /** Distinct accounts that followed it within the window. */
  followers: number;
}

export interface PopularPanda {
  pandaId: string;
  slug: string;
}

/** Most new followers first (ties by slug), published pandas only, at or above the floor, at most `limit`. */
export function rankPopular(
  counts: readonly FollowCount[],
  published: ReadonlyMap<string, string>,
  { minFollowers = POPULAR_MIN_FOLLOWERS, limit = POPULAR_LIMIT } = {},
): PopularPanda[] {
  return counts
    .flatMap((count) => {
      const slug = published.get(count.pandaId);
      return count.followers >= minFollowers && slug !== undefined ? [{ ...count, slug }] : [];
    })
    .sort((a, b) => b.followers - a.followers || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map(({ pandaId, slug }) => ({ pandaId, slug }));
}
