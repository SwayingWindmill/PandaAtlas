/**
 * 每日打卡 (daily check-in) rules. Every quota lives in DAILY_CHECKIN_RULES so
 * the numbers can change in one place; the API returns them with each summary
 * and the app reads its copy from there.
 *
 * Product rules:
 * - A day counts when the member opens 每日一猫 while signed in (kind = visit).
 * - Totals never reset: we report total days and days this month, no streak.
 * - Each calendar month has `leaveDaysPerMonth` leave days (请假), a retroactive
 *   leave (补请) included. A leave day is simply not a missed day.
 * - A missed day can be covered retroactively on the next two days
 *   (`retroWindowHours`), at most `retroLeavesPerMonth` times a month.
 * - Visiting on a day that already had leave turns it into a visit and gives
 *   the leave day back.
 * - Everything is free.
 */
export const DAILY_CHECKIN_RULES = {
  leaveDaysPerMonth: 2,
  retroLeavesPerMonth: 1,
  retroWindowHours: 48,
  leaveAheadDays: 31,
} as const;

export type DailyCheckinRules = typeof DAILY_CHECKIN_RULES;
export type DailyCheckinKind = "visit" | "leave";

export interface DailyCheckinRecord {
  day: string;
  kind: DailyCheckinKind;
  retroactive: boolean;
}

export interface DailyCheckinMonth {
  month: string;
  visitDays: number;
  leaveDays: number;
  leaveLeft: number;
  retroLeft: number;
}

export interface DailyCheckinSummary {
  today: string;
  rules: DailyCheckinRules;
  visitedToday: boolean;
  totalVisitDays: number;
  firstDay: string | null;
  thisMonth: DailyCheckinMonth;
  retroDay: string | null;
  days: DailyCheckinRecord[];
}

export type DailyCheckinRefusal = "dayClosed" | "quotaUsed" | "todayOutOfRange";

export type DailyCheckinChange =
  | { kind: "put"; record: DailyCheckinRecord }
  | { kind: "remove"; day: string }
  | { kind: "none" };

export type DailyCheckinDecision = { ok: true; change: DailyCheckinChange } | { ok: false; refusal: DailyCheckinRefusal };

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isCalendarDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (match === null) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** The member's local date may differ from the server's UTC date by one day either way. */
export function acceptsToday(today: string, now: Date): boolean {
  if (!isCalendarDay(today)) return false;
  return Math.abs(daysBetween(now.toISOString().slice(0, 10), today)) <= 1;
}

/** Days after the missed day on which 补请 is still open: 48h → the next 2 days. */
function retroWindowDays(rules: DailyCheckinRules): number {
  return Math.max(0, Math.floor(rules.retroWindowHours / 24));
}

function monthCounts(records: readonly DailyCheckinRecord[], month: string) {
  let visitDays = 0;
  let leaveDays = 0;
  let retroDays = 0;
  for (const record of records) {
    if (monthOf(record.day) !== month) continue;
    if (record.kind === "visit") visitDays += 1;
    else {
      leaveDays += 1;
      if (record.retroactive) retroDays += 1;
    }
  }
  return { visitDays, leaveDays, retroDays };
}

function firstVisit(records: readonly DailyCheckinRecord[]): string | null {
  let first: string | null = null;
  for (const record of records) {
    if (record.kind === "visit" && (first === null || record.day < first)) first = record.day;
  }
  return first;
}

function retroAllowed(
  records: readonly DailyCheckinRecord[],
  day: string,
  today: string,
  rules: DailyCheckinRules,
): DailyCheckinRefusal | null {
  const gap = daysBetween(day, today);
  if (gap < 1 || gap > retroWindowDays(rules)) return "dayClosed";
  if (records.some((record) => record.day === day)) return "dayClosed";
  const first = firstVisit(records);
  if (first === null || day < first) return "dayClosed";
  const counts = monthCounts(records, monthOf(day));
  if (counts.leaveDays >= rules.leaveDaysPerMonth || counts.retroDays >= rules.retroLeavesPerMonth) {
    return "quotaUsed";
  }
  return null;
}

export function summarizeDailyCheckins(
  records: readonly DailyCheckinRecord[],
  today: string,
  rules: DailyCheckinRules = DAILY_CHECKIN_RULES,
): DailyCheckinSummary {
  const days = [...records].sort((a, b) => a.day.localeCompare(b.day));
  const month = monthOf(today);
  const counts = monthCounts(days, month);
  let retroDay: string | null = null;
  for (let gap = 1; gap <= retroWindowDays(rules); gap += 1) {
    const candidate = addDays(today, -gap);
    if (retroAllowed(days, candidate, today, rules) === null) {
      retroDay = candidate;
      break;
    }
  }
  return {
    today,
    rules,
    visitedToday: days.some((record) => record.day === today && record.kind === "visit"),
    totalVisitDays: days.filter((record) => record.kind === "visit").length,
    firstDay: firstVisit(days),
    thisMonth: {
      month,
      visitDays: counts.visitDays,
      leaveDays: counts.leaveDays,
      leaveLeft: Math.max(0, rules.leaveDaysPerMonth - counts.leaveDays),
      retroLeft: Math.max(0, rules.retroLeavesPerMonth - counts.retroDays),
    },
    retroDay,
    days,
  };
}

/** Opening 每日一猫 today. A leave already taken for today is given back. */
export function decideVisit(records: readonly DailyCheckinRecord[], today: string): DailyCheckinDecision {
  const existing = records.find((record) => record.day === today);
  if (existing?.kind === "visit") return { ok: true, change: { kind: "none" } };
  return { ok: true, change: { kind: "put", record: { day: today, kind: "visit", retroactive: false } } };
}

/** 请假 for today or a coming day, or 补请 for one of the last two days. */
export function decideLeave(
  records: readonly DailyCheckinRecord[],
  day: string,
  today: string,
  rules: DailyCheckinRules = DAILY_CHECKIN_RULES,
): DailyCheckinDecision {
  if (!isCalendarDay(day)) return { ok: false, refusal: "dayClosed" };
  const existing = records.find((record) => record.day === day);
  if (existing?.kind === "leave") return { ok: true, change: { kind: "none" } };
  if (existing?.kind === "visit") return { ok: false, refusal: "dayClosed" };

  const ahead = daysBetween(today, day);
  if (ahead >= 0) {
    if (ahead > rules.leaveAheadDays) return { ok: false, refusal: "dayClosed" };
    if (monthCounts(records, monthOf(day)).leaveDays >= rules.leaveDaysPerMonth) {
      return { ok: false, refusal: "quotaUsed" };
    }
    return { ok: true, change: { kind: "put", record: { day, kind: "leave", retroactive: false } } };
  }

  const refusal = retroAllowed(records, day, today, rules);
  if (refusal !== null) return { ok: false, refusal };
  return { ok: true, change: { kind: "put", record: { day, kind: "leave", retroactive: true } } };
}

/** Cancel a leave for today or a coming day. Past days stay as they are. */
export function decideCancelLeave(
  records: readonly DailyCheckinRecord[],
  day: string,
  today: string,
): DailyCheckinDecision {
  if (!isCalendarDay(day) || day < today) return { ok: false, refusal: "dayClosed" };
  const existing = records.find((record) => record.day === day);
  if (existing === undefined) return { ok: true, change: { kind: "none" } };
  if (existing.kind !== "leave") return { ok: false, refusal: "dayClosed" };
  return { ok: true, change: { kind: "remove", day } };
}
