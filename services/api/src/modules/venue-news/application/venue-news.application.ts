import { type PublicVenueNews, type VenueNewsCatalogRow, publishedVenueNews } from "./venue-news-catalog.js";

export interface VenueNewsRepository {
  current(): Promise<VenueNewsCatalogRow | null>;
}

export const VENUE_NEWS_REPOSITORY = Symbol("VENUE_NEWS_REPOSITORY");
export const VENUE_NEWS_PORT = Symbol("VENUE_NEWS_PORT");

export class VenueNewsApplication {
  public constructor(private readonly repository: VenueNewsRepository) {}

  public async published(institutionSlug?: string): Promise<PublicVenueNews> {
    return publishedVenueNews(await this.repository.current(), institutionSlug);
  }
}
