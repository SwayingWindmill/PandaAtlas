import { api } from "@/lib/api";
import { updatedDay } from "./format";
import type { PandaNewsCardItem, VenueNewsItem } from "./merge";

export type { PandaNewsCardItem, VenueNewsItem } from "./merge";
export { mergePandaNewsItems } from "./merge";

/** Published 场馆动态, newest first. Each item is an official announcement's own headline and link. */
export async function loadVenueNews(institution?: string): Promise<VenueNewsItem[]> {
  const { data, error } = await api.GET("/api/v2/venue-news", {
    params: { query: institution ? { institution } : {} },
  });
  if (error || !data) throw new Error("venue news unavailable");
  return data.items.filter((item) => item.sourceUrl.startsWith("https://"));
}

/** Published live panda news links for one panda, newest first. */
export async function loadPandaNews(pandaSlug: string): Promise<PandaNewsCardItem[]> {
  const { data, error } = await api.GET("/api/v2/news", {
    params: { query: { panda: pandaSlug, limit: 5 } },
  });
  if (error || !data) throw new Error("panda news unavailable");
  return data.items
    .filter((item) => item.sourceUrl.startsWith("https://"))
    .map((item) => ({
      id: item.newsItemId,
      institutionSlug: item.institutionSlug ?? "",
      kind: item.kind,
      headline: item.titleZh,
      pandaSlugs: item.pandaSlugs,
      sourceUrl: item.sourceUrl,
      sourcePublisher: item.sourcePublisher,
      publishedOn: updatedDay(item.publishedAt),
      updatedAt: item.publishedAt,
    }));
}

export { daysUntil, dotDate, sourceHost, updatedDay } from "./format";
