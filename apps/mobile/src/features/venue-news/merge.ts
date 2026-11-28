export type VenueNewsItem = {
  id: string;
  institutionSlug: string;
  kind: string;
  headline: string;
  pandaSlugs: string[];
  sourceUrl: string;
  sourcePublisher: string;
  publishedOn: string;
  updatedAt: string;
};

export type PandaNewsCardItem = VenueNewsItem;

/** Merge curated venue notices and live panda news, keeping official notices on duplicate URLs. */
export function mergePandaNewsItems(
  venueNews: readonly VenueNewsItem[],
  pandaNews: readonly PandaNewsCardItem[],
  slug: string,
  limit = 3,
): PandaNewsCardItem[] {
  const byUrl = new Map<string, PandaNewsCardItem>();
  for (const item of venueNews) {
    if (!item.sourceUrl.startsWith("https://") || !item.pandaSlugs.includes(slug)) continue;
    if (!byUrl.has(item.sourceUrl)) byUrl.set(item.sourceUrl, item);
  }
  for (const item of pandaNews) {
    if (!item.sourceUrl.startsWith("https://")) continue;
    if (item.pandaSlugs.length > 0 && !item.pandaSlugs.includes(slug)) continue;
    if (!byUrl.has(item.sourceUrl)) byUrl.set(item.sourceUrl, item);
  }
  return [...byUrl.values()]
    .sort((left, right) => right.publishedOn.localeCompare(left.publishedOn) || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}
