import type { ColumnType } from "kysely";

/**
 * Hand-written. place.venue_news_catalog stores one jsonb document, parsed in
 * application code, so it is not part of the kysely-codegen run.
 */
export interface VenueNewsCatalogTable {
  catalog_id: number;
  version: string;
  document: ColumnType<unknown, string, string>;
  updated_at: ColumnType<Date, Date | string, Date | string>;
}

export interface DB {
  "place.venue_news_catalog": VenueNewsCatalogTable;
}
