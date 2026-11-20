import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { AskPrivacyPort, AskQuestionCountExport } from "../application/ask-privacy.port.js";

export class PostgresAskPrivacyQuery implements AskPrivacyPort {
  public async exportPrivacySubject(
    transaction: DatabaseTransaction,
    accountId: string,
  ): Promise<AskQuestionCountExport[]> {
    // 问问熊猫 keeps only how many questions an account asked each day, never the questions.
    const rows = await transaction
      .selectFrom("ask.account_daily_usage")
      .select(["usage_on", "question_count"])
      .where("account_id", "=", accountId)
      .orderBy("usage_on")
      .execute();
    return rows.map((row) => ({ day: row.usage_on, questions: row.question_count }));
  }

  public async erasePrivacySubject(transaction: DatabaseTransaction, accountId: string): Promise<void> {
    await transaction.deleteFrom("ask.account_daily_usage").where("account_id", "=", accountId).execute();
  }
}
