import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  UpdateChangeType,
  UpdateItem,
  UpdateType,
  UpdatesRepository,
} from "../application/updates.application.js";

export class PostgresUpdatesRepository implements UpdatesRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async list(limit: number): Promise<UpdateItem[]> {
    const rows = await this.database.db
      .selectFrom("updates.items")
      .selectAll()
      .orderBy("published_at", "desc")
      .orderBy("update_id", "desc")
      .limit(limit)
      .execute();
    if (rows.length === 0) return [];

    const targets = await this.database.db
      .selectFrom("updates.targets")
      .selectAll()
      .where("update_id", "in", rows.map((row) => row.update_id))
      .orderBy("resource_kind")
      .orderBy("resource_id")
      .execute();
    const targetsByUpdate = new Map<string, UpdateItem["targets"]>();
    for (const target of targets) {
      const values = targetsByUpdate.get(target.update_id) ?? [];
      values.push({
        resourceKind: target.resource_kind,
        resourceId: target.resource_id,
        changeType: target.change_type as UpdateChangeType,
      });
      targetsByUpdate.set(target.update_id, values);
    }

    return rows.map((row) => ({
      updateId: row.update_id,
      updateType: row.update_type as UpdateType,
      releaseId: row.release_id,
      ...(row.previous_release_id === null ? {} : { previousReleaseId: row.previous_release_id }),
      releaseVersion: row.release_version,
      occurredAt: row.occurred_at.toISOString(),
      publishedAt: row.published_at.toISOString(),
      targets: targetsByUpdate.get(row.update_id) ?? [],
    }));
  }
}
