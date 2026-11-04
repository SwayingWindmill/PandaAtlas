import { api } from "@/lib/api";

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

/** Published 场馆动态, newest first. Each item is an official announcement's own headline and link. */
export async function loadVenueNews(institution?: string): Promise<VenueNewsItem[]> {
  const { data, error } = await api.GET("/api/v2/venue-news", {
    params: { query: institution ? { institution } : {} },
  });
  if (error || !data) throw new Error("venue news unavailable");
  return data.items.filter((item) => item.sourceUrl.startsWith("https://"));
}

export { daysUntil, dotDate, sourceHost, updatedDay } from "./format";
