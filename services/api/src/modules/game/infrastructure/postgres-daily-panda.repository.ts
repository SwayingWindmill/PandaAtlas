import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { DailyPandaRepository } from "../application/daily-panda.application.js";

export class PostgresDailyPandaRepository implements DailyPandaRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async findPandaId(puzzleDate: string): Promise<string | undefined> {
    const row = await this.database.db
      .selectFrom("game.daily_pandas")
      .select("panda_id")
      .where("puzzle_date", "=", puzzleDate)
      .executeTakeFirst();
    return row?.panda_id;
  }

  public async recentPandaIds(since: string, until: string): Promise<string[]> {
    const rows = await this.database.db
      .selectFrom("game.daily_pandas")
      .select("panda_id")
      .where("puzzle_date", ">=", since)
      .where("puzzle_date", "<=", until)
      .execute();
    return rows.map((row) => row.panda_id);
  }

  public async choosePanda(puzzleDate: string, pandaId: string): Promise<string> {
    await this.database.db
      .insertInto("game.daily_pandas")
      .values({ puzzle_date: puzzleDate, panda_id: pandaId })
      .onConflict((conflict) => conflict.column("puzzle_date").doNothing())
      .execute();
    const row = await this.database.db
      .selectFrom("game.daily_pandas")
      .select("panda_id")
      .where("puzzle_date", "=", puzzleDate)
      .executeTakeFirstOrThrow();
    return row.panda_id;
  }
}
