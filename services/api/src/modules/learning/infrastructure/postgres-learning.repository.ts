import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { LearningCatalogRow } from "../application/learning-catalog.js";
import type { LearningRepository } from "../application/learning.application.js";

export class PostgresLearningRepository implements LearningRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async current(): Promise<LearningCatalogRow | null> {
    const row = await this.database.db
      .selectFrom("learning.catalog")
      .select(["version", "document"])
      .where("catalog_id", "=", 1)
      .executeTakeFirst();
    return row === undefined ? null : { version: row.version, document: row.document };
  }
}
