import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { OverseasStatusCatalogRow } from "../application/overseas-status-catalog.js";
import type { OverseasStatusRepository } from "../application/overseas-status.application.js";

export class PostgresOverseasStatusRepository implements OverseasStatusRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async current(): Promise<OverseasStatusCatalogRow | null> {
    const row = await this.database.db
      .selectFrom("place.overseas_status_catalog")
      .select(["version", "document"])
      .where("catalog_id", "=", 1)
      .executeTakeFirst();
    return row === undefined ? null : { version: row.version, document: row.document };
  }
}
