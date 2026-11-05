import type { GameEntry, SeenEntry } from "@/features/book/book";

// 年度回顾 (v4 `10-year-review`): the fan's own year, told only from their records. The first panda they met
// that year, the pandas they saw, the days they checked in and the places they went, check-ins by month, and
// the year's firsts. Counts and names only; nothing here guesses. Pure rules; loading is in load.ts.

export type FirstKind = "recognized" | "seen" | "visit" | "checkin";

export interface YearFirst {
  kind: FirstKind;
  /** YYYY-MM-DD. */
  date: string;
  /** The panda it is about, for a 认出 or a 见过. */
  pandaId: string | null;
  /** The place, for a 去过. */
  placeId: string | null;
}

export interface YearReview {
  year: number;
  /** True while the year is still going: counts are "so far". */
  partial: boolean;
  /** The first panda met that year, either way. */
  first: { pandaId: string; date: string } | null;
  /** Pandas marked 见过 with a day in the year. */
  seen: number;
  /** Pandas first 认出 in the year. */
  recognized: number;
  /** Days checked in. */
  checkinDays: number;
  /** Places visited, each counted once. */
  places: number;
  /** Check-in days per month, January first. */
  months: number[];
  /** The month with the most check-in days (1–12), or null when none. */
  busiest: number | null;
  /** The first 认出, 见过, 去过 and 打卡 of the year, oldest first. */
  firsts: YearFirst[];
  empty: boolean;
}

export interface YearInput {
  year: number;
  today: string;
  games: readonly GameEntry[];
  seen: readonly SeenEntry[];
  visits: readonly { placeId: string; visitedOn: string }[];
  checkins: readonly { day: string; kind: string }[];
}

const day = (value: string) => value.slice(0, 10);

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

function earliest<T>(items: T[], dateOf: (item: T) => string): T | null {
  return items.reduce<T | null>((best, item) => (best === null || dateOf(item) < dateOf(best) ? item : best), null);
}

export function yearReview({ year, today, games, seen, visits, checkins }: YearInput): YearReview {
  const prefix = String(year);
  const end = today.startsWith(prefix) ? today : `${prefix}-12-31`;
  const inYear = (value: string | null | undefined): value is string => Boolean(value && day(value).startsWith(prefix) && day(value) <= end);

  const recognizedIn = games.filter((game) => inYear(game.firstMetAt));
  const seenIn = seen.filter((item) => inYear(item.seenOn ?? item.firstSeenAt));
  const visitsIn = visits.filter((visit) => inYear(visit.visitedOn));
  const checkinsIn = checkins.filter((item) => item.kind === "visit" && inYear(item.day));

  const months = Array.from({ length: 12 }, () => 0);
  for (const item of checkinsIn) months[Number(item.day.slice(5, 7)) - 1]! += 1;
  const most = Math.max(...months);
  const busiest = most > 0 ? months.indexOf(most) + 1 : null;

  const firstGame = earliest(recognizedIn, (game) => day(game.firstMetAt));
  const firstSeen = earliest(seenIn, (item) => day(item.seenOn ?? item.firstSeenAt));
  const firstVisit = earliest(visitsIn, (visit) => visit.visitedOn);
  const firstCheckin = earliest(checkinsIn, (item) => item.day);
  const firsts: YearFirst[] = [
    ...(firstGame ? [{ kind: "recognized" as const, date: day(firstGame.firstMetAt), pandaId: firstGame.pandaId, placeId: null }] : []),
    ...(firstSeen ? [{ kind: "seen" as const, date: day(firstSeen.seenOn ?? firstSeen.firstSeenAt), pandaId: firstSeen.pandaId, placeId: null }] : []),
    ...(firstVisit ? [{ kind: "visit" as const, date: firstVisit.visitedOn, pandaId: null, placeId: firstVisit.placeId }] : []),
    ...(firstCheckin ? [{ kind: "checkin" as const, date: firstCheckin.day, pandaId: null, placeId: null }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const met = firsts.filter((item): item is YearFirst & { pandaId: string } => item.pandaId !== null);
  const first = met[0] ? { pandaId: met[0].pandaId, date: met[0].date } : null;

  return {
    year,
    partial: end === today,
    first,
    seen: new Set(seenIn.map((item) => item.pandaId)).size,
    recognized: new Set(recognizedIn.map((game) => game.pandaId)).size,
    checkinDays: checkinsIn.length,
    places: new Set(visitsIn.map((visit) => visit.placeId)).size,
    months,
    busiest,
    firsts,
    empty: recognizedIn.length + seenIn.length + visitsIn.length + checkinsIn.length === 0,
  };
}

/** "03.14", as the 第一次 timeline dates a day. */
export function monthDot(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}
