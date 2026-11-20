import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type {
  DailyCheckinPrivacyExport,
  DailyCheckinPrivacyPort,
} from "../application/daily-checkin-privacy.port.js";

export class PostgresDailyCheckinPrivacyQuery implements DailyCheckinPrivacyPort {
  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<DailyCheckinPrivacyExport[]> {
    const rows = await transaction
      .selectFrom("engagement.daily_checkins")
      .select(["checkin_on", "kind", "retroactive", "created_at", "updated_at"])
      .where("account_id", "=", accountId)
      .orderBy("checkin_on")
      .execute();
    return rows.map((row) => ({
      day: row.checkin_on,
      kind: row.kind,
      retroactive: row.retroactive,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    await transaction.deleteFrom("engagement.daily_checkins").where("account_id", "=", accountId).execute();
  }
}
