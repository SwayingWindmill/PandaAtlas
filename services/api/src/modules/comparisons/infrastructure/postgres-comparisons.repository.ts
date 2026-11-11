import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { ComparisonCatalogRow } from "../application/comparison-catalog.js";
import type { ComparisonsRepository } from "../application/comparisons.application.js";

export class PostgresComparisonsRepository implements ComparisonsRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async current(): Promise<ComparisonCatalogRow | null> {
    const row = await this.database.db
      .selectFrom("place.comparison_catalog")
      .select(["version", "document"])
      .where("catalog_id", "=", 1)
      .executeTakeFirst();
    return row === undefined ? null : { version: row.version, document: row.document };
  }
}
