import type { Kysely } from "kysely";

import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { Database } from "../../../platform/database/database.types.js";
import type {
  DailyPandaResultRecord,
  PandaBookEntry,
  PandaBookGame,
  PandaBookRepository,
} from "../application/panda-book.application.js";

/** Adds a panda to the fan's book, or counts one more meeting when it is already there. */
export async function recordEncounter(
  executor: Kysely<Database>,
  accountId: string,
  pandaId: string,
  game: PandaBookGame,
): Promise<void> {
  await executor
    .insertInto("game.encounters")
    .values({ account_id: accountId, panda_id: pandaId, first_game: game })
    .onConflict((conflict) =>
      conflict.columns(["account_id", "panda_id"]).doUpdateSet((update) => ({
        last_met_at: update.fn("now"),
        times_met: update("game.encounters.times_met", "+", 1),
      })),
    )
    .execute();
}

export class PostgresPandaBookRepository implements PandaBookRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async listEncounters(accountId: string): Promise<PandaBookEntry[]> {
    const rows = await this.database.db
      .selectFrom("game.encounters")
      .select(["panda_id", "first_game", "first_met_at", "last_met_at", "times_met"])
      .where("account_id", "=", accountId)
      .orderBy("first_met_at", "desc")
      .orderBy("panda_id")
      .execute();
    return rows.map((row) => ({
      pandaId: row.panda_id,
      firstGame: row.first_game as PandaBookGame,
      firstMetAt: row.first_met_at,
      lastMetAt: row.last_met_at,
      timesMet: row.times_met,
    }));
  }

  public async saveDailyPandaResult(accountId: string, record: DailyPandaResultRecord): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const inserted = await transaction
        .insertInto("game.daily_panda_results")
        .values({
          account_id: accountId,
          puzzle_date: record.puzzleDate,
          panda_id: record.pandaId,
          solved: record.solved,
          guess_count: record.guessCount,
        })
        .onConflict((conflict) => conflict.columns(["account_id", "puzzle_date"]).doNothing())
        .returning("puzzle_date")
        .executeTakeFirst();
      if (inserted === undefined) return false;
      await recordEncounter(transaction, accountId, record.pandaId, "daily_panda");
      return true;
    });
  }
}
