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

  public async listFavoritedPandaIds(transaction: DatabaseTransaction): Promise<string[]> {
    const rows = await transaction
      .selectFrom("engagement.favorites")
      .select("panda_id")
      .distinct()
      .orderBy("panda_id")
      .execute();
    return rows.map((row) => row.panda_id);
  }

  public async listAccountsFollowingInstitutions(
    transaction: DatabaseTransaction,
    institutionIds: readonly string[],
  ): Promise<string[]> {
    if (institutionIds.length === 0) return [];
    const rows = await transaction
      .selectFrom("engagement.venue_follows")
      .select("account_id")
      .distinct()
      .where("institution_id", "in", [...institutionIds])
      .orderBy("account_id")
      .execute();
    return rows.map((row) => row.account_id);
  }
}
