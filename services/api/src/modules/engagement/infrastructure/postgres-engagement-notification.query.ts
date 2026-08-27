import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { EngagementNotificationAudiencePort } from "../application/engagement-notification.port.js";

export class PostgresEngagementNotificationQuery implements EngagementNotificationAudiencePort {
  public async listAccountsFavoritingPandas(
    transaction: DatabaseTransaction,
    pandaIds: readonly string[],
  ): Promise<string[]> {
    if (pandaIds.length === 0) return [];
    const rows = await transaction
      .selectFrom("engagement.favorites")
      .select("account_id")
      .distinct()
      .where("panda_id", "in", [...pandaIds])
      .orderBy("account_id")
      .execute();
    return rows.map((row) => row.account_id);
  }
}
