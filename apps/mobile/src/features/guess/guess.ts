import { loadPandaIndex } from "@/features/pandas/pandas";
import { api, authedApi, publicMediaUrl } from "@/lib/api";

import type { GuessDifficulty } from "./difficulty";

// 猜熊猫: a published photo and four names. The server keeps the answer until a choice is sent.

export { DIFFICULTIES, type GuessDifficulty, difficultyOf } from "./difficulty";

export interface GuessQuestion {
  questionId: string;
  photoUrl: string;
  difficulty: GuessDifficulty;
  options: { pandaId: string; name: string; slug: string | null }[];
}

export interface GuessOutcome {
  correct: boolean;
  answerPandaId: string;
  tips: string[];
}

export class NoQuestionError extends Error {}

/** Any level when `difficulty` is undefined. A level with no published question throws NoQuestionError. */
export async function loadQuestion(difficulty?: GuessDifficulty): Promise<GuessQuestion> {
  const [{ data, response }, pandas] = await Promise.all([
    api.GET("/api/v2/games/guess/question", { params: { query: difficulty ? { difficulty } : {} } }),
    loadPandaIndex(),
  ]);
  if (response.status === 404) throw new NoQuestionError("No published question");
  if (!data) throw new Error(`Question unavailable (${response.status})`);
  const byId = new Map(pandas.map((panda) => [panda.id, panda]));
  return {
    questionId: data.questionId,
    photoUrl: publicMediaUrl(data.photoObjectKey),
    difficulty: data.difficulty,
    options: data.optionPandaIds.map((pandaId) => ({
      pandaId,
      name: byId.get(pandaId)?.name ?? "熊猫",
      slug: byId.get(pandaId)?.slug ?? null,
    })),
  };
}

/** Signed in, the attempt is recorded (and a correct one joins the 图鉴); signed out, it is only checked. */
export async function answerQuestion(questionId: string, selectedPandaId: string, signedIn: boolean): Promise<GuessOutcome> {
  const body = { questionId, selectedPandaId };
  const result = signedIn
    ? await authedApi.POST("/api/v2/me/game-attempts", { body }).then(({ data }) => data?.answer)
    : await api.POST("/api/v2/games/guess/answer", { body }).then(({ data }) => data);
  if (!result) throw new Error("Answer not accepted");
  return { correct: result.correct, answerPandaId: result.answerPandaId, tips: result.recognitionTips };
}
