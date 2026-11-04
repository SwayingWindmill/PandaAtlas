import type { LifeEvent } from "../timeline/timeline";

// 年度回顾: one year told only from the published record. Births from the panda index's birth dates, birthdays
// of living pandas with a known day, and the moves and homecomings the life events record (completed, sourced,
// dated to that year). Counts and names only: no sentence here says anything the record does not.
// Pure rules; loading is in load.ts.

export interface ReviewPanda {
  id: string;
  slug: string;
  name: string;
  birthDate: string | null;
  deceased: boolean;
}

export interface ReviewPlace {
  name: string | null;
  countryCode: string | null;
}

export interface ReviewMove {
  eventId: string;
  date: string;
  pandaId: string;
  slug: string;
  name: string;
  /** "抵达上野动物园", "回国，住进碧峰峡基地": the same words as the panda's timeline. */
  text: string;
  home: boolean;
}

export interface YearReview {
  year: number;
  /** True while the year is still going: counts are "so far". */
  partial: boolean;
  births: ReviewPanda[];
  /** Living pandas with a known birthday that fell in the year, up to today. */
  birthdays: number;
  moves: ReviewMove[];
  homecomings: number;
  /** Nothing at all recorded for the year. */
  empty: boolean;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MOVE_TYPES = new Set(["arrival", "transfer", "return"]);

/** The years a review can be asked for: the current one and the three before it. */
export function reviewYears(today: string): number[] {
  const year = Number(today.slice(0, 4));
  return [year, year - 1, year - 2, year - 3];
}

/** A `?year=` value the page accepts, or the current year. */
export function parseYear(value: string | undefined, today: string): number {
  const years = reviewYears(today);
  const asked = value && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return years.includes(asked) ? asked : years[0]!;
}

function moveText(event: LifeEvent, places: ReadonlyMap<string, ReviewPlace>, home: boolean): string {
  const to = event.toPlaceId ? places.get(event.toPlaceId)?.name : null;
  const from = event.fromPlaceId ? places.get(event.fromPlaceId)?.name : null;
  if (home) return to ? `回国，住进${to}` : "回国";
  if (event.eventType === "arrival") return to ? `抵达${to}` : "抵达新家";
  if (from && to) return `从${from}搬到${to}`;
  return to ? `搬到${to}` : "搬家";
}

export function yearReview(input: {
  year: number;
  today: string;
  pandas: readonly ReviewPanda[];
  events: readonly LifeEvent[];
  places: ReadonlyMap<string, ReviewPlace>;
  /** Restrict to one panda. */
  pandaId?: string;
}): YearReview {
  const { year, today, places } = input;
  const prefix = String(year);
  const end = today.startsWith(prefix) ? today : `${prefix}-12-31`;
  const pandas = input.pandaId ? input.pandas.filter((panda) => panda.id === input.pandaId) : input.pandas;
  const byId = new Map(input.pandas.map((panda) => [panda.id, panda]));

  const births = pandas
    .filter((panda) => panda.birthDate?.startsWith(prefix) && panda.birthDate.slice(0, 10) <= end)
    .sort((a, b) => (a.birthDate ?? "").localeCompare(b.birthDate ?? "") || a.name.localeCompare(b.name, "zh-CN"));

  const birthdays = pandas.filter((panda) => {
    const match = panda.birthDate ? DAY.exec(panda.birthDate) : null;
    if (!match || panda.deceased || Number(match[1]) >= year) return false;
    return `${prefix}-${match[2]}-${match[3] === "29" && match[2] === "02" ? "28" : match[3]}` <= end;
  }).length;

  const moves: ReviewMove[] = [];
  for (const event of input.events) {
    if (event.eventStatus !== "completed" || !MOVE_TYPES.has(event.eventType) || event.sourceIds.length === 0) continue;
    const date = event.occurredOn?.slice(0, 10);
    if (!date?.startsWith(prefix) || date > end) continue;
    const from = event.fromPlaceId ? places.get(event.fromPlaceId) : undefined;
    const to = event.toPlaceId ? places.get(event.toPlaceId) : undefined;
    const home =
      event.eventType === "return" ||
      (Boolean(from?.countryCode) && from?.countryCode !== "CN" && to?.countryCode === "CN");
    for (const pandaId of event.participantIds) {
      const panda = byId.get(pandaId);
      if (!panda || (input.pandaId && pandaId !== input.pandaId)) continue;
      moves.push({ eventId: event.eventId, date, pandaId, slug: panda.slug, name: panda.name, text: moveText(event, places, home), home });
    }
  }
  moves.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "zh-CN"));

  return {
    year,
    partial: end === today,
    births,
    birthdays,
    moves,
    homecomings: moves.filter((move) => move.home).length,
    empty: births.length === 0 && birthdays === 0 && moves.length === 0,
  };
}
