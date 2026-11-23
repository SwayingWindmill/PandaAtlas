import { queryOptions } from "@tanstack/react-query";

import { loadPandaIndex } from "@/features/pandas/pandas";
import { api, authedApi, publicMediaUrl } from "@/lib/api";
import { queryClient } from "@/lib/query-client";

import { DIFFICULTIES, type GuessDifficulty, type LevelProbe } from "./difficulty";

const DIFFICULTY_VALUES = DIFFICULTIES.map(({ value }) => value);

// 猜熊猫: a published photo and four names. The server keeps the answer until a choice is sent.

export { DIFFICULTIES, type GuessDifficulty, type LevelProbe, difficultyOf, offeredLevels } from "./difficulty";

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

export type LevelCheck = { probe: LevelProbe; question?: GuessQuestion };

/**
 * Asks each level for a question once, so a level with none can be left out of the picker before anyone taps it.
 * A question that comes back is kept, so choosing that level shows it without a second request.
 */
export async function probeLevels(): Promise<Record<GuessDifficulty, LevelCheck>> {
  const checks = await Promise.all(
    DIFFICULTY_VALUES.map((difficulty) =>
      loadQuestion(difficulty).then(
        (question): LevelCheck => ({ probe: "ready", question }),
        (error: unknown): LevelCheck => ({ probe: error instanceof NoQuestionError ? "empty" : "unknown" }),
      ),
    ),
  );
  return Object.fromEntries(DIFFICULTY_VALUES.map((difficulty, index) => [difficulty, checks[index]])) as Record<
    GuessDifficulty,
    LevelCheck
  >;
}

/** Nothing is kept once the game closes: every visit checks the levels again. */
export function levelChecksQueryOptions() {
  return queryOptions({
    queryKey: ["public", "guess-levels"],
    queryFn: probeLevels,
    staleTime: 0,
    gcTime: 0,
    networkMode: "always",
    refetchOnWindowFocus: false,
  });
}

/** The question a level probe already returned is shown once; every other request draws a new one. */
async function nextQuestion(level: GuessDifficulty | undefined): Promise<GuessQuestion> {
  const checks = queryClient.getQueryData(levelChecksQueryOptions().queryKey);
  const ready = level ? checks?.[level]?.question : undefined;
  if (checks && level && ready) {
    queryClient.setQueryData(levelChecksQueryOptions().queryKey, { ...checks, [level]: { probe: checks[level].probe } });
    return ready;
  }
  return loadQuestion(level);
}

/**
 * One drawn question per level and round. A draw is random, so it is never refetched or kept: a round that
 * is left (another level, the next question) is dropped, and an answer cannot meet a different question.
 */
export function questionQueryOptions(level: GuessDifficulty | undefined, round: number) {
  return queryOptions({
    queryKey: ["public", "guess-question", level ?? "any", round],
    queryFn: () => nextQuestion(level),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: false,
  });
}
