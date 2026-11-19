import type { DatabaseService } from "../../../platform/database/database.service.js";

export type JsonCatalogTable =
  | "learning.catalog"
  | "place.comparison_catalog"
  | "place.overseas_status_catalog"
  | "place.venue_news_catalog";

export interface JsonCatalogRow {
  version: string;
  document: unknown;
}

export class PostgresJsonCatalogStore {
  public constructor(private readonly database: DatabaseService) {}

  public async current(table: JsonCatalogTable): Promise<JsonCatalogRow | null> {
    const row = await this.database.db
      .selectFrom(table)
      .select(["version", "document"])
      .where("catalog_id", "=", 1)
      .executeTakeFirst();
    return row === undefined ? null : { version: row.version, document: row.document };
  }
}
