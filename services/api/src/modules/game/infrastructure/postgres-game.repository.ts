import { sql } from "kysely";
import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  GameDifficulty,
  GameRepository,
  GuessAnswer,
  GuessEvaluation,
  GuessQuestion,
  RandomPandaCandidate,
  SaveAttemptResult,
  SavedGameAttempt,
} from "../application/game.application.js";

function recognitionTips(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tip): tip is string => typeof tip === "string") : [];
}

function difficulty(value: string): GameDifficulty {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  throw new Error(`Unsupported game difficulty: ${value}`);
}

export class PostgresGameRepository implements GameRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async randomPandaCandidate(): Promise<RandomPandaCandidate | undefined> {
    const row = await this.database.db
      .selectFrom("game.questions")
      .select("target_panda_id")
      .where("state", "=", "published")
      .groupBy("target_panda_id")
      .orderBy(sql`random()`)
      .limit(1)
      .executeTakeFirst();
    return row === undefined ? undefined : { pandaId: row.target_panda_id };
  }

  public async getGuessQuestion(difficultyFilter?: GameDifficulty): Promise<GuessQuestion | undefined> {
    let query = this.database.db
      .selectFrom("game.questions")
      .select(["question_id", "media_asset_id", "difficulty", "option_panda_ids"])
      .where("state", "=", "published");
    if (difficultyFilter !== undefined) {
      query = query.where("difficulty", "=", difficultyFilter);
    }
    const row = await query.orderBy(sql`random()`).limit(1).executeTakeFirst();
    return row === undefined
      ? undefined
      : {
          questionId: row.question_id,
          mediaAssetId: row.media_asset_id,
          difficulty: difficulty(row.difficulty),
          optionPandaIds: row.option_panda_ids,
        };
  }

  public async evaluateGuess(questionId: string, selectedPandaId: string): Promise<GuessEvaluation> {
    const row = await this.database.db
      .selectFrom("game.questions")
      .select(["target_panda_id", "option_panda_ids", "recognition_tips"])
      .where("question_id", "=", questionId)
      .where("state", "=", "published")
      .executeTakeFirst();
    if (row === undefined) return { kind: "question_not_found" };
    if (!row.option_panda_ids.includes(selectedPandaId)) return { kind: "invalid_option" };
    return {
      kind: "answer",
      answer: this.answer(row.target_panda_id, selectedPandaId, row.recognition_tips),
    };
  }

  public async listAttempts(accountId: string): Promise<SavedGameAttempt[]> {
    const rows = await this.database.db
      .selectFrom("game.attempts")
      .select(["attempt_id", "question_id", "selected_panda_id", "correct", "attempted_at"])
      .where("account_id", "=", accountId)
      .orderBy("attempted_at", "desc")
      .orderBy("attempt_id", "desc")
      .execute();
    return rows.map((row) => ({
      attemptId: row.attempt_id,
      questionId: row.question_id,
      selectedPandaId: row.selected_panda_id,
      correct: row.correct,
      attemptedAt: row.attempted_at,
    }));
  }

  public async saveAttempt(
    accountId: string,
    questionId: string,
    selectedPandaId: string,
  ): Promise<SaveAttemptResult> {
    return this.database.transaction(async (transaction) => {
      const question = await transaction
        .selectFrom("game.questions")
        .select(["target_panda_id", "option_panda_ids", "recognition_tips"])
        .where("question_id", "=", questionId)
        .where("state", "=", "published")
        .executeTakeFirst();
      if (question === undefined) return { kind: "question_not_found" as const };
      if (!question.option_panda_ids.includes(selectedPandaId)) return { kind: "invalid_option" as const };

      const answer = this.answer(question.target_panda_id, selectedPandaId, question.recognition_tips);
      const row = await transaction
        .insertInto("game.attempts")
        .values({
          account_id: accountId,
          question_id: questionId,
          selected_panda_id: selectedPandaId,
          correct: answer.correct,
        })
        .returning(["attempt_id", "question_id", "selected_panda_id", "correct", "attempted_at"])
        .executeTakeFirstOrThrow();
      return {
        kind: "saved" as const,
        answer,
        attempt: {
          attemptId: row.attempt_id,
          questionId: row.question_id,
          selectedPandaId: row.selected_panda_id,
          correct: row.correct,
          attemptedAt: row.attempted_at,
        },
      };
    });
  }

  private answer(targetPandaId: string, selectedPandaId: string, tips: unknown): GuessAnswer {
    return {
      correct: selectedPandaId === targetPandaId,
      answerPandaId: targetPandaId,
      recognitionTips: recognitionTips(tips),
    };
  }
}
