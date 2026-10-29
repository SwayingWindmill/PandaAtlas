import type { ColumnType } from "kysely";

/**
 * Hand-written. learning.catalog stores one jsonb document, and the API parses
 * it in application code, so this schema is not part of the kysely-codegen run.
 */
export interface LearningCatalogTable {
  catalog_id: number;
  version: string;
  document: ColumnType<unknown, string, string>;
  updated_at: ColumnType<Date, Date | string, Date | string>;
}

export interface DB {
  "learning.catalog": LearningCatalogTable;
}
