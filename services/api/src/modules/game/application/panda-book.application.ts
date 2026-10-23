import type { PublicReadPort } from "../../publication/application/public-read.application.js";
import type { DailyPandaApplication, DailyPandaGuessResult } from "./daily-panda.application.js";

export type PandaBookGame = "guess_panda" | "daily_panda";

export interface PandaBookEntry {
  pandaId: string;
  firstGame: PandaBookGame;
  firstMetAt: Date;
  lastMetAt: Date;
  timesMet: number;
}

export interface PandaBook {
  /** Pandas in the current public release: the size of a full book. */
  publishedCount: number;
  knownCount: number;
  /** Newest first. Pandas no longer published are left out. */
  items: PandaBookEntry[];
}

export interface DailyPandaResultRecord {
  puzzleDate: string;
  pandaId: string;
  solved: boolean;
  guessCount: number;
}

export type SaveDailyPandaResult =
  | { kind: "unavailable" }
  | { kind: "too_many_guesses" }
  | { kind: "unknown_panda" }
  | { kind: "not_finished" }
  | { kind: "ok"; result: DailyPandaGuessResult; saved: boolean };

export interface PandaBookRepository {
  listEncounters(accountId: string): Promise<PandaBookEntry[]>;
  /**
   * Saves the day's result and adds its panda to the book. Returns false when the fan already
   * saved that day, in which case nothing changes.
   */
  saveDailyPandaResult(accountId: string, record: DailyPandaResultRecord): Promise<boolean>;
}

export const PANDA_BOOK_REPOSITORY = Symbol("PANDA_BOOK_REPOSITORY");
export const PANDA_BOOK_PORT = Symbol("PANDA_BOOK_PORT");

export class PandaBookApplication {
  public constructor(
    private readonly repository: PandaBookRepository,
    private readonly dailyPanda: DailyPandaApplication,
    private readonly publicRead: PublicReadPort,
  ) {}

  public async book(accountId: string): Promise<PandaBook | undefined> {
    const pandas = await this.publicRead.listPandas();
    if (pandas.kind !== "ok") return undefined;
    const published = new Set(pandas.value.items.map((panda) => panda.pandaId));
    const items = (await this.repository.listEncounters(accountId)).filter((entry) => published.has(entry.pandaId));
    return { publishedCount: published.size, knownCount: items.length, items };
  }

  /** Saves today's Daily Panda once it is finished; the server re-checks the guesses. */
  public async saveDailyPanda(accountId: string, guessPandaIds: readonly string[]): Promise<SaveDailyPandaResult> {
    const evaluated = await this.dailyPanda.guess(guessPandaIds);
    if (evaluated.kind !== "ok") return evaluated;
    const { result } = evaluated;
    if (!result.finished || result.answer === undefined) return { kind: "not_finished" };
    const saved = await this.repository.saveDailyPandaResult(accountId, {
      puzzleDate: result.puzzleDate,
      pandaId: result.answer.pandaId,
      solved: result.solved,
      guessCount: result.guesses.length,
    });
    return { kind: "ok", result, saved };
  }
}
