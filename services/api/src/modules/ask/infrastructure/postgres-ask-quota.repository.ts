import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { AskQuotaRepository, QuotaReservation } from "../application/ask.ports.js";

class QuotaFull extends Error {}

/** Counts questions per account and app-wide per Beijing day. Only counts; never question text. */
export class PostgresAskQuotaRepository implements AskQuotaRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async used(accountId: string, day: string): Promise<number> {
    const row = await this.database.db
      .selectFrom("ask.account_daily_usage")
      .select("question_count")
      .where("account_id", "=", accountId)
      .where("usage_on", "=", day)
      .executeTakeFirst();
    return row?.question_count ?? 0;
  }

  public async reserve(accountId: string, day: string, accountLimit: number, globalCap: number): Promise<QuotaReservation> {
    if (globalCap <= 0) return { ok: false, scope: "global" };
    if (accountLimit <= 0) return { ok: false, scope: "account" };
    try {
      return await this.database.db.transaction().execute(async (trx) => {
        const global = await trx
          .insertInto("ask.daily_usage")
          .values({ usage_on: day, question_count: 1 })
          .onConflict((conflict) =>
            conflict
              .column("usage_on")
              .doUpdateSet((eb) => ({ question_count: eb("ask.daily_usage.question_count", "+", 1) }))
              .where("ask.daily_usage.question_count", "<", globalCap),
          )
          .returning("question_count")
          .executeTakeFirst();
        if (global === undefined) throw new QuotaFull("global");
        const account = await trx
          .insertInto("ask.account_daily_usage")
          .values({ account_id: accountId, usage_on: day, question_count: 1 })
          .onConflict((conflict) =>
            conflict
              .columns(["account_id", "usage_on"])
              .doUpdateSet((eb) => ({ question_count: eb("ask.account_daily_usage.question_count", "+", 1) }))
              .where("ask.account_daily_usage.question_count", "<", accountLimit),
          )
          .returning("question_count")
          .executeTakeFirst();
        // Rolling back keeps the app-wide count from charging a question that was not asked.
        if (account === undefined) throw new QuotaFull("account");
        return { ok: true as const, remainingToday: Math.max(0, accountLimit - account.question_count) };
      });
    } catch (error) {
      if (error instanceof QuotaFull) return { ok: false, scope: error.message === "account" ? "account" : "global" };
      throw error;
    }
  }
}
