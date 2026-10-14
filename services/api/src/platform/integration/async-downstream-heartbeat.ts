import { sql } from "kysely";
import type { DatabaseService } from "../database/database.service.js";

// When the Cron Trigger's async downstream cycle last completed every stage. A failing stage or a
// dead trigger leaves it ageing; an idle system keeps it fresh (#560). A message that keeps failing is
// dead-lettered instead (#629).
export class AsyncDownstreamHeartbeat {
  public constructor(private readonly database: DatabaseService) {}

  public async recordSuccess(): Promise<void> {
    await this.database.db
      .updateTable("integration.async_downstream_heartbeat")
      .set({ last_succeeded_at: sql<string>`now()` })
      .execute();
  }

  public async secondsSinceSuccess(): Promise<number> {
    const row = await this.database.db
      .selectFrom("integration.async_downstream_heartbeat")
      .select(sql<number>`floor(extract(epoch from now() - last_succeeded_at))::int`.as("seconds"))
      .executeTakeFirstOrThrow();
    return row.seconds;
  }
}
