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
    return {
      attempts: attempts.map((row) => ({
        attemptId: row.attempt_id,
        questionId: row.question_id,
        selectedPandaId: row.selected_panda_id,
        correct: row.correct,
        attemptedAt: row.attempted_at.toISOString(),
      })),
    };
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    await transaction.deleteFrom("game.attempts").where("account_id", "=", accountId).execute();
  }
}
