import { sql } from "kysely";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { DailyCheckinDecision, DailyCheckinRecord } from "../application/daily-checkin.js";
import type { DailyCheckinRepository } from "../application/daily-checkin.application.js";

export class PostgresDailyCheckinRepository implements DailyCheckinRepository {
  public constructor(private readonly database: DatabaseService) {}

  public listDailyCheckins(accountId: string): Promise<DailyCheckinRecord[]> {
    return this.readDailyCheckins(this.database.db, accountId);
  }

  public editDailyCheckins(
    accountId: string,
    decide: (records: DailyCheckinRecord[]) => DailyCheckinDecision,
  ): Promise<{ decision: DailyCheckinDecision; records: DailyCheckinRecord[] }> {
    return this.database.transaction(async (transaction) => {
      // One member's quota checks must not interleave (two taps on two devices).
      await sql`select pg_advisory_xact_lock(hashtext(${`engagement.daily_checkins:${accountId}`}))`.execute(transaction);
      const records = await this.readDailyCheckins(transaction, accountId);
      const decision = decide(records);
      if (!decision.ok || decision.change.kind === "none") return { decision, records };
      if (decision.change.kind === "remove") {
        await transaction
          .deleteFrom("engagement.daily_checkins")
          .where("account_id", "=", accountId)
          .where("checkin_on", "=", decision.change.day)
          .execute();
      } else {
        const { day, kind, retroactive } = decision.change.record;
        await transaction
          .insertInto("engagement.daily_checkins")
          .values({ account_id: accountId, checkin_on: day, kind, retroactive })
          .onConflict((conflict) =>
            conflict.columns(["account_id", "checkin_on"]).doUpdateSet({ kind, retroactive, updated_at: new Date() }),
          )
          .execute();
      }
      return { decision, records: await this.readDailyCheckins(transaction, accountId) };
    });
  }

  private async readDailyCheckins(
    db: DatabaseService["db"] | DatabaseTransaction,
    accountId: string,
  ): Promise<DailyCheckinRecord[]> {
    const rows = await db
      .selectFrom("engagement.daily_checkins")
      .select(["checkin_on", "kind", "retroactive"])
      .where("account_id", "=", accountId)
      .orderBy("checkin_on")
      .execute();
    return rows.map((row) => ({
      day: row.checkin_on,
      kind: row.kind === "leave" ? "leave" : "visit",
      retroactive: row.retroactive,
    }));
  }
}
