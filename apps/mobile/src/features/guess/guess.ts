import { loadPandaIndex } from "@/features/pandas/pandas";
import { api, authedApi, publicMediaUrl } from "@/lib/api";

// 猜熊猫: a published photo and four names. The server keeps the answer until a choice is sent.

export interface GuessQuestion {
  questionId: string;
  photoUrl: string;
  options: { pandaId: string; name: string }[];
}

export interface GuessOutcome {
  correct: boolean;
  answerPandaId: string;
  tips: string[];
}

export class NoQuestionError extends Error {}

export async function loadQuestion(): Promise<GuessQuestion> {
  const [{ data, response }, pandas] = await Promise.all([api.GET("/api/v2/games/guess/question"), loadPandaIndex()]);
  if (response.status === 404) throw new NoQuestionError("No published question");
  if (!data) throw new Error(`Question unavailable (${response.status})`);
  const names = new Map(pandas.map((panda) => [panda.id, panda.name]));
  return {
    questionId: data.questionId,
    photoUrl: publicMediaUrl(data.photoObjectKey),
    options: data.optionPandaIds.map((pandaId) => ({ pandaId, name: names.get(pandaId) ?? "熊猫" })),
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
