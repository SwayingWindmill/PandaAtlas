import type {
  PublicPandaSummary,
  PublicReadPort,
} from "../../publication/application/public-read.application.js";

export const DAILY_PANDA_MAX_GUESSES = 6;
// A panda chosen for one day is not chosen again within this many days.
export const DAILY_PANDA_REPEAT_WINDOW_DAYS = 60;
const DAILY_PANDA_TIME_ZONE = "Asia/Shanghai";

// Clues in reveal order. A clue the panda's published facts cannot fill is skipped.
export type DailyPandaClue =
  | { kind: "sex"; value: "female" | "male" }
  | { kind: "birth_year"; value: number }
  | { kind: "life_status"; value: "alive" | "deceased" }
  | { kind: "birthplace"; value: string }
  | { kind: "name_initial"; value: string }
  | { kind: "photo"; assetId: string; objectKey: string };

export interface DailyPandaPuzzle {
  puzzleDate: string;
  maxGuesses: number;
  clueCount: number;
  clues: DailyPandaClue[];
}

export type BirthYearHint = "answer_earlier" | "answer_later" | "same" | "unknown";

export interface DailyPandaGuessFeedback {
  pandaId: string;
  correct: boolean;
  sameSex: boolean | null;
  birthYear: BirthYearHint;
}

export interface DailyPandaGuessResult {
  puzzleDate: string;
  solved: boolean;
  finished: boolean;
  guesses: DailyPandaGuessFeedback[];
  clues: DailyPandaClue[];
  /** Present once the puzzle is finished. */
  answer?: { pandaId: string; canonicalSlug: string };
}

export type DailyPandaRead =
  | { kind: "unavailable" }
  | { kind: "ok"; puzzle: DailyPandaPuzzle };

export type DailyPandaGuess =
  | { kind: "unavailable" }
  | { kind: "too_many_guesses" }
  | { kind: "unknown_panda" }
  | { kind: "ok"; result: DailyPandaGuessResult };

export interface DailyPandaRepository {
  findPandaId(puzzleDate: string): Promise<string | undefined>;
  /** Pandas chosen on the days from `since` up to and including `until`. */
  recentPandaIds(since: string, until: string): Promise<string[]>;
  /** Records the day's panda unless another request already did; returns the day's panda. */
  choosePanda(puzzleDate: string, pandaId: string): Promise<string>;
}

export const DAILY_PANDA_REPOSITORY = Symbol("DAILY_PANDA_REPOSITORY");
export const DAILY_PANDA_PORT = Symbol("DAILY_PANDA_PORT");

type PandaFacts = PublicPandaSummary["facts"];

// Only structured facts that are not disputed become clues.
function factText(facts: PandaFacts, fieldKey: string): string | undefined {
  const fact = facts.find((item) => item.fieldKey === fieldKey && item.status !== "disputed");
  return typeof fact?.value === "string" && fact.value.trim() !== "" ? fact.value.trim() : undefined;
}

function sexOf(facts: PandaFacts): "female" | "male" | undefined {
  const value = factText(facts, "sex");
  return value === "female" || value === "male" ? value : undefined;
}

function birthYearOf(facts: PandaFacts): number | undefined {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(factText(facts, "birth_date") ?? "");
  return match === null ? undefined : Number(match[1]);
}

function lifeStatusOf(facts: PandaFacts): "alive" | "deceased" | undefined {
  const value = factText(facts, "life_status");
  return value === "alive" || value === "deceased" ? value : undefined;
}

function chineseName(panda: PublicPandaSummary): string | undefined {
  return panda.names.find((name) => name.isPrimary && name.languageTag.startsWith("zh"))?.value;
}

/** A panda can be the day's panda when it has a sex, a birth year and a Chinese name. */
export function isDailyPandaCandidate(panda: PublicPandaSummary): boolean {
  return sexOf(panda.facts) !== undefined
    && birthYearOf(panda.facts) !== undefined
    && chineseName(panda) !== undefined;
}

export function dailyPandaClues(
  panda: PublicPandaSummary,
  photo: { assetId: string; objectKey: string } | undefined,
): DailyPandaClue[] {
  const clues: DailyPandaClue[] = [];
  const sex = sexOf(panda.facts);
  if (sex !== undefined) clues.push({ kind: "sex", value: sex });
  const birthYear = birthYearOf(panda.facts);
  if (birthYear !== undefined) clues.push({ kind: "birth_year", value: birthYear });
  const lifeStatus = lifeStatusOf(panda.facts);
  if (lifeStatus !== undefined) clues.push({ kind: "life_status", value: lifeStatus });
  const birthplace = factText(panda.facts, "birthplace");
  if (birthplace !== undefined) clues.push({ kind: "birthplace", value: birthplace });
  const initial = chineseName(panda)?.at(0);
  if (initial !== undefined) clues.push({ kind: "name_initial", value: initial });
  if (photo !== undefined) clues.push({ kind: "photo", assetId: photo.assetId, objectKey: photo.objectKey });
  return clues;
}

export function compareGuess(answer: PublicPandaSummary, guess: PublicPandaSummary): DailyPandaGuessFeedback {
  const answerSex = sexOf(answer.facts);
  const guessSex = sexOf(guess.facts);
  const answerYear = birthYearOf(answer.facts);
  const guessYear = birthYearOf(guess.facts);
  let birthYear: BirthYearHint = "unknown";
  if (answerYear !== undefined && guessYear !== undefined) {
    birthYear = answerYear === guessYear ? "same" : answerYear < guessYear ? "answer_earlier" : "answer_later";
  }
  return {
    pandaId: guess.pandaId,
    correct: guess.pandaId === answer.pandaId,
    sameSex: answerSex === undefined || guessSex === undefined ? null : answerSex === guessSex,
    birthYear,
  };
}

export function puzzleDateOf(instant: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_PANDA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export class DailyPandaApplication {
  public constructor(
    private readonly repository: DailyPandaRepository,
    private readonly publicRead: PublicReadPort,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {}

  /** Today's puzzle with only its first clue; the rest are revealed by wrong guesses. */
  public async today(): Promise<DailyPandaRead> {
    const day = await this.loadDay();
    if (day === undefined) return { kind: "unavailable" };
    return {
      kind: "ok",
      puzzle: {
        puzzleDate: day.puzzleDate,
        maxGuesses: DAILY_PANDA_MAX_GUESSES,
        clueCount: day.clues.length,
        clues: day.clues.slice(0, 1),
      },
    };
  }

  /**
   * Evaluates every guess made so far today, in order. The player gets one more clue for each
   * wrong guess, and the answer once the panda is found or the guesses run out.
   */
  public async guess(guessPandaIds: readonly string[]): Promise<DailyPandaGuess> {
    if (guessPandaIds.length > DAILY_PANDA_MAX_GUESSES) return { kind: "too_many_guesses" };
    const day = await this.loadDay();
    if (day === undefined) return { kind: "unavailable" };

    const pandas = await this.publicRead.listPandas();
    if (pandas.kind !== "ok") return { kind: "unavailable" };
    const byId = new Map(pandas.value.items.map((panda) => [panda.pandaId, panda]));
    const guesses: DailyPandaGuessFeedback[] = [];
    for (const pandaId of guessPandaIds) {
      const guess = byId.get(pandaId);
      if (guess === undefined) return { kind: "unknown_panda" };
      guesses.push(compareGuess(day.panda, guess));
    }

    const solvedAt = guesses.findIndex((guess) => guess.correct);
    const solved = solvedAt !== -1;
    const counted = solved ? guesses.slice(0, solvedAt + 1) : guesses;
    const finished = solved || counted.length === DAILY_PANDA_MAX_GUESSES;
    const wrong = counted.filter((guess) => !guess.correct).length;
    return {
      kind: "ok",
      result: {
        puzzleDate: day.puzzleDate,
        solved,
        finished,
        guesses: counted,
        clues: finished ? day.clues : day.clues.slice(0, 1 + wrong),
        ...(finished ? { answer: { pandaId: day.panda.pandaId, canonicalSlug: day.panda.canonicalSlug } } : {}),
      },
    };
  }

  private async loadDay(): Promise<{ puzzleDate: string; panda: PublicPandaSummary; clues: DailyPandaClue[] } | undefined> {
    const puzzleDate = puzzleDateOf(this.now());
    const pandaId = (await this.repository.findPandaId(puzzleDate)) ?? (await this.choose(puzzleDate));
    if (pandaId === undefined) return undefined;

    const detail = await this.publicRead.getPanda(pandaId);
    if (detail.kind !== "ok") return undefined;
    const image = detail.value.media.find((item) => item.mediaType.startsWith("image/"));
    const photo = image === undefined ? undefined : { assetId: image.assetId, objectKey: image.objectKey };
    return { puzzleDate, panda: detail.value.panda, clues: dailyPandaClues(detail.value.panda, photo) };
  }

  private async choose(puzzleDate: string): Promise<string | undefined> {
    const pandas = await this.publicRead.listPandas();
    if (pandas.kind !== "ok") return undefined;
    const recent = new Set(
      await this.repository.recentPandaIds(shiftDate(puzzleDate, -DAILY_PANDA_REPEAT_WINDOW_DAYS), puzzleDate),
    );
    const candidates = pandas.value.items.filter(isDailyPandaCandidate);
    const fresh = candidates.filter((panda) => !recent.has(panda.pandaId));
    const pool = fresh.length > 0 ? fresh : candidates;
    const chosen = pool[Math.floor(this.random() * pool.length)];
    return chosen === undefined ? undefined : this.repository.choosePanda(puzzleDate, chosen.pandaId);
  }
}
