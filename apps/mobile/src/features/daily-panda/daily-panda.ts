import AsyncStorage from "@react-native-async-storage/async-storage";
import type { components } from "@zhipanda/api-client";

import { api, authedApi, publicMediaUrl } from "@/lib/api";
import { displayChineseName, englishName } from "@/lib/panda";

type Schemas = components["schemas"];
export type DailyPandaGuessFeedback = Schemas["DailyPandaGuessFeedbackDto"];

/** A text clue keeps its kind and raw value so the screen can pick a glyph; `label` and `text` are what it reads. */
export type DailyPandaClue =
  | { kind: "sex" | "birth_year" | "life_status" | "birthplace" | "name_initial"; value: string; label: string; text: string }
  | { kind: "photo"; imageUrl: string };

export interface DailyPandaState {
  puzzleDate: string;
  maxGuesses: number;
  clueCount: number;
  clues: DailyPandaClue[];
  guesses: DailyPandaGuessFeedback[];
  solved: boolean;
  finished: boolean;
  answer?: { pandaId: string; canonicalSlug: string };
}

export interface PandaChoice {
  id: string;
  slug: string;
  name: string;
  alternateName: string | null;
}

function clueOf(clue: Schemas["DailyPandaClueDto"]): DailyPandaClue[] {
  const value = String(clue.value ?? "");
  switch (clue.kind) {
    case "sex":
      return [{ kind: "sex", value, label: "性别", text: clue.value === "female" ? "雌性" : "雄性" }];
    case "birth_year":
      return [{ kind: "birth_year", value, label: "出生", text: `${value} 年` }];
    case "life_status":
      return [{ kind: "life_status", value, label: "现在", text: clue.value === "alive" ? "在世" : "已经离世" }];
    case "birthplace":
      return [{ kind: "birthplace", value, label: "出生地", text: value }];
    case "name_initial":
      return [{ kind: "name_initial", value, label: "名字的第一个字", text: value }];
    case "photo":
      return clue.objectKey ? [{ kind: "photo", imageUrl: publicMediaUrl(clue.objectKey) }] : [];
    default:
      return [];
  }
}

/** Each fact the guess got right or wrong, shown side by side without separators. */
export function feedbackParts(feedback: DailyPandaGuessFeedback): string[] {
  const parts: string[] = [];
  if (feedback.sameSex !== null) parts.push(feedback.sameSex ? "性别相同" : "性别不同");
  if (feedback.birthYear === "answer_earlier") parts.push("它出生更早");
  if (feedback.birthYear === "answer_later") parts.push("它出生更晚");
  if (feedback.birthYear === "same") parts.push("同年出生");
  return parts;
}

// Today's guesses stay on the device so reopening the app resumes the puzzle.
const storageKey = (puzzleDate: string) => `zhipanda:daily-panda:${puzzleDate}`;

async function storedGuesses(puzzleDate: string): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(storageKey(puzzleDate))) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function guessDailyPanda(base: DailyPandaState, guessPandaIds: string[]): Promise<DailyPandaState> {
  const { data, error } = await api.POST("/api/v2/games/daily-panda/guesses", { body: { guessPandaIds } });
  if (!data) throw new Error(`Daily Panda guess failed: ${JSON.stringify(error)}`);
  await AsyncStorage.setItem(storageKey(data.puzzleDate), JSON.stringify(data.guesses.map((guess) => guess.pandaId)));
  return {
    ...base,
    puzzleDate: data.puzzleDate,
    clues: data.clues.flatMap(clueOf),
    guesses: data.guesses,
    solved: data.solved,
    finished: data.finished,
    answer: data.answer,
  };
}

/**
 * Records a finished puzzle on the signed-in fan's account; the API replays the guesses, so the result
 * cannot be forged, and a second save of the same day changes nothing. The answer joins the 图鉴.
 */
export async function saveDailyResult(state: DailyPandaState): Promise<boolean> {
  if (!state.finished) return false;
  const { data } = await authedApi.POST("/api/v2/me/daily-panda-results", {
    body: { guessPandaIds: state.guesses.map((guess) => guess.pandaId) },
  });
  return data !== undefined;
}

export async function loadDailyPanda(): Promise<DailyPandaState> {
  const { data, error } = await api.GET("/api/v2/games/daily-panda");
  if (!data) throw new Error(`Daily Panda unavailable: ${JSON.stringify(error)}`);
  const state: DailyPandaState = {
    puzzleDate: data.puzzleDate,
    maxGuesses: data.maxGuesses,
    clueCount: data.clueCount,
    clues: data.clues.flatMap(clueOf),
    guesses: [],
    solved: false,
    finished: false,
  };
  const stored = await storedGuesses(data.puzzleDate);
  return stored.length > 0 ? guessDailyPanda(state, stored) : state;
}

export async function loadPandaChoices(): Promise<PandaChoice[]> {
  const { data, error } = await api.GET("/api/v2/pandas");
  if (!data) throw new Error(`Panda list unavailable: ${JSON.stringify(error)}`);
  return data.items.map((panda) => {
    const zh = displayChineseName(panda);
    const en = englishName(panda);
    return { id: panda.pandaId, slug: panda.canonicalSlug, name: zh ?? en ?? panda.canonicalSlug, alternateName: zh ? en : null };
  });
}
