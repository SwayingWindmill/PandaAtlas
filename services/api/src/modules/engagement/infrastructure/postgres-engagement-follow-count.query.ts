import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  EngagementFollowCount,
  EngagementFollowCountPort,
} from "../application/engagement-follow-count.port.js";

export class PostgresEngagementFollowCountQuery implements EngagementFollowCountPort {
  public constructor(private readonly database: DatabaseService) {}

  public async followCounts(since: Date): Promise<EngagementFollowCount[]> {
    const rows = await this.database.db
      .selectFrom("engagement.favorites")
      .select(["panda_id", sql<string>`count(distinct account_id)`.as("followers")])
      .where("favorited_at", ">=", since)
      .groupBy("panda_id")
      .execute();
    return rows.map((row) => ({ pandaId: row.panda_id, followers: Number(row.followers) }));
  }
}
