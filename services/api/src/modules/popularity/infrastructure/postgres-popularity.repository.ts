import { sql } from "kysely";

import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { FollowCount } from "../application/popular-pandas.js";
import type { PopularityRepository } from "../application/popularity.application.js";

export class PostgresPopularityRepository implements PopularityRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async followCounts(since: Date): Promise<FollowCount[]> {
    const rows = await this.database.db
      .selectFrom("engagement.favorites")
      .select(["panda_id", sql<string>`count(distinct account_id)`.as("followers")])
      .where("favorited_at", ">=", since)
      .groupBy("panda_id")
      .execute();
    return rows.map((row) => ({ pandaId: row.panda_id, followers: Number(row.followers) }));
  }
}
