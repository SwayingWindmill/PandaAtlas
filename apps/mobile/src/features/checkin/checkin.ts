import type { components } from "@zhipanda/api-client";

import { authedApi } from "@/lib/api";
import { localToday } from "../engagement/seen";

// 每日打卡: a signed-in fan's day counts once they open 每日一猫. The API keeps the days and the
// quotas (DAILY_CHECKIN_RULES in services/api); the app only reads them. No streaks: totals never reset.

export type CheckinSummary = components["schemas"]["DailyCheckinSummaryDto"];
export type CheckinRules = CheckinSummary["rules"];
export type CheckinDayMark = "visit" | "leave" | "retro" | "plannable" | "none";

export type CheckinFailure = "quotaUsed" | "dayClosed" | "failed";

export class CheckinError extends Error {
  public constructor(public readonly failure: CheckinFailure) {
    super(`Daily check-in ${failure}`);
  }
}

const DAY_MS = 86_400_000;

export function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
}

/** Monday to Sunday of the week `today` falls in, as the calendar grid starts its weeks. */
export function weekOf(today: string): string[] {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => addDays(today, index - weekday));
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Leave days still free in a month, from the days the API returned. */
export function leaveLeftIn(summary: CheckinSummary, month: string): number {
  const used = summary.days.filter((day) => day.kind === "leave" && day.day.startsWith(month)).length;
  return Math.max(0, summary.rules.leaveDaysPerMonth - used);
}

/** Visit days in a month. */
export function visitsIn(summary: CheckinSummary, month: string): number {
  return summary.days.filter((day) => day.kind === "visit" && day.day.startsWith(month)).length;
}

/** What a day on the grid shows, and whether tapping it does anything. */
export function dayMark(summary: CheckinSummary, day: string): CheckinDayMark {
  const record = summary.days.find((item) => item.day === day);
  if (record) return record.kind === "visit" ? "visit" : "leave";
  if (day === summary.retroDay) return "retro";
  const ahead = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${summary.today}T00:00:00Z`)) / DAY_MS);
  if (ahead >= 0 && ahead <= summary.rules.leaveAheadDays && leaveLeftIn(summary, day.slice(0, 7)) > 0) {
    return "plannable";
  }
  return "none";
}

/** A leave the fan can still take back: today's or a coming day's. */
export function cancellable(summary: CheckinSummary, day: string): boolean {
  return day >= summary.today && summary.days.some((item) => item.day === day && item.kind === "leave");
}

/** Today's and coming leave days, soonest first. */
export function upcomingLeave(summary: CheckinSummary): string[] {
  return summary.days.filter((day) => day.kind === "leave" && day.day >= summary.today).map((day) => day.day);
}

/** The rules in one calm sentence, read from the API's numbers. */
export function rulesNote(rules: CheckinRules): string {
  return `每个月有 ${rules.leaveDaysPerMonth} 天假，月初重新算。没来的一天，${rules.retroWindowHours} 小时内还能补请，每月 ${rules.retroLeavesPerMonth} 次。累计天数一直保留，不会清零。`;
}

async function settle(
  request: Promise<{ data?: CheckinSummary; error?: unknown; response: Response }>,
): Promise<CheckinSummary> {
  const { data, error, response } = await request;
  if (data) return data;
  const code = (error as { code?: string } | undefined)?.code;
  if (response.status === 409 && code === "engagement.leaveQuotaUsed") throw new CheckinError("quotaUsed");
  if (response.status === 409) throw new CheckinError("dayClosed");
  throw new CheckinError("failed");
}

export function loadCheckins(today = localToday()): Promise<CheckinSummary> {
  return settle(authedApi.GET("/api/v2/me/daily-checkins", { params: { query: { today } } }));
}

export function recordCheckin(today = localToday()): Promise<CheckinSummary> {
  return settle(authedApi.POST("/api/v2/me/daily-checkins", { body: { today } }));
}

export function takeLeave(day: string, today = localToday()): Promise<CheckinSummary> {
  return settle(authedApi.PUT("/api/v2/me/daily-checkins/leave/{day}", { params: { path: { day } }, body: { today } }));
}

export function cancelLeave(day: string, today = localToday()): Promise<CheckinSummary> {
  return settle(
    authedApi.DELETE("/api/v2/me/daily-checkins/leave/{day}", { params: { path: { day }, query: { today } } }),
  );
}

const recorded = new Map<string, Promise<CheckinSummary | null>>();

/**
 * Opening 每日一猫 counts the day. Sent once per account and day while the app runs; a failure is
 * quiet (the puzzle still works) and is tried again on the next open.
 */
export function recordTodayOnce(accountId: string, today = localToday()): Promise<CheckinSummary | null> {
  const key = `${accountId}:${today}`;
  const existing = recorded.get(key);
  if (existing) return existing;
  const pending = recordCheckin(today).catch(() => {
    recorded.delete(key);
    return null;
  });
  recorded.set(key, pending);
  return pending;
}
