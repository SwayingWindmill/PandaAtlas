import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { VenueNewsCatalogRow } from "../application/venue-news-catalog.js";
import type { VenueNewsRepository } from "../application/venue-news.application.js";

export class PostgresVenueNewsRepository implements VenueNewsRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async current(): Promise<VenueNewsCatalogRow | null> {
    const row = await this.database.db
      .selectFrom("place.venue_news_catalog")
      .select(["version", "document"])
      .where("catalog_id", "=", 1)
      .executeTakeFirst();
    return row === undefined ? null : { version: row.version, document: row.document };
  }
}
