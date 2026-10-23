import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { GamePrivacyPort } from "../application/game-privacy.port.js";

export class PostgresGamePrivacyQuery implements GamePrivacyPort {
  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<Record<string, unknown>> {
    const attempts = await transaction
      .selectFrom("game.attempts")
      .select(["attempt_id", "question_id", "selected_panda_id", "correct", "attempted_at"])
      .where("account_id", "=", accountId)
      .orderBy("attempted_at")
      .execute();
    const encounters = await transaction
      .selectFrom("game.encounters")
      .select(["panda_id", "first_game", "first_met_at", "last_met_at", "times_met"])
      .where("account_id", "=", accountId)
      .orderBy("first_met_at")
      .execute();
    const dailyPandaResults = await transaction
      .selectFrom("game.daily_panda_results")
      .select(["puzzle_date", "panda_id", "solved", "guess_count", "saved_at"])
      .where("account_id", "=", accountId)
      .orderBy("puzzle_date")
      .execute();
    return {
      attempts: attempts.map((row) => ({
        attemptId: row.attempt_id,
        questionId: row.question_id,
        selectedPandaId: row.selected_panda_id,
        correct: row.correct,
        attemptedAt: row.attempted_at.toISOString(),
      })),
      pandaBook: encounters.map((row) => ({
        pandaId: row.panda_id,
        firstGame: row.first_game,
        firstMetAt: row.first_met_at.toISOString(),
        lastMetAt: row.last_met_at.toISOString(),
        timesMet: row.times_met,
      })),
      dailyPandaResults: dailyPandaResults.map((row) => ({
        puzzleDate: row.puzzle_date,
        pandaId: row.panda_id,
        solved: row.solved,
        guessCount: row.guess_count,
        savedAt: row.saved_at.toISOString(),
      })),
    };
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    await transaction.deleteFrom("game.attempts").where("account_id", "=", accountId).execute();
    await transaction.deleteFrom("game.encounters").where("account_id", "=", accountId).execute();
    await transaction.deleteFrom("game.daily_panda_results").where("account_id", "=", accountId).execute();
  }
}
