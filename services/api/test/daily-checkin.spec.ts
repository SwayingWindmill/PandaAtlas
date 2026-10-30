import { describe, expect, it } from "vitest";

import {
  DAILY_CHECKIN_RULES,
  acceptsToday,
  decideCancelLeave,
  decideLeave,
  decideVisit,
  summarizeDailyCheckins,
  type DailyCheckinDecision,
  type DailyCheckinRecord,
} from "../src/modules/engagement/application/daily-checkin.js";
import { EngagementApplication, type EngagementRepository } from "../src/modules/engagement/application/engagement.application.js";

const visit = (day: string): DailyCheckinRecord => ({ day, kind: "visit", retroactive: false });
const leave = (day: string, retroactive = false): DailyCheckinRecord => ({ day, kind: "leave", retroactive });

function memoryRepository(initial: DailyCheckinRecord[] = []) {
  let records = [...initial];
  const repository = {
    listDailyCheckins: () => Promise.resolve([...records]),
    editDailyCheckins: (_accountId: string, decide: (current: DailyCheckinRecord[]) => DailyCheckinDecision) => {
      const decision = decide([...records]);
      if (decision.ok && decision.change.kind === "put") {
        const next = decision.change.record;
        records = [...records.filter((record) => record.day !== next.day), next];
      }
      if (decision.ok && decision.change.kind === "remove") {
        const day = decision.change.day;
        records = records.filter((record) => record.day !== day);
      }
      return Promise.resolve({ decision, records: [...records] });
    },
  } as unknown as EngagementRepository;
  return { repository, records: () => records };
}

describe("daily check-in rules", () => {
  it("keeps every quota in one config", () => {
    expect(DAILY_CHECKIN_RULES).toEqual({
      leaveDaysPerMonth: 2,
      retroLeavesPerMonth: 1,
      retroWindowHours: 48,
      leaveAheadDays: 31,
    });
  });

  it("counts totals and this month without any streak, and never resets after a gap", () => {
    const summary = summarizeDailyCheckins(
      [visit("2026-09-01"), visit("2026-09-02"), visit("2026-10-20"), leave("2026-10-21"), visit("2026-10-29")],
      "2026-10-30",
    );
    expect(summary.totalVisitDays).toBe(4);
    expect(summary.firstDay).toBe("2026-09-01");
    expect(summary.visitedToday).toBe(false);
    expect(summary.thisMonth).toEqual({ month: "2026-10", visitDays: 2, leaveDays: 1, leaveLeft: 1, retroLeft: 1 });
    expect(summary).not.toHaveProperty("streak");
  });

  it("turns today's leave into a visit and gives the leave day back", () => {
    const decision = decideVisit([leave("2026-10-30")], "2026-10-30");
    expect(decision).toEqual({ ok: true, change: { kind: "put", record: visit("2026-10-30") } });
    expect(decideVisit([visit("2026-10-30")], "2026-10-30")).toEqual({ ok: true, change: { kind: "none" } });
  });

  it("allows two leave days per calendar month, counted by the leave day's month", () => {
    const records = [leave("2026-11-03"), leave("2026-11-04")];
    expect(decideLeave(records, "2026-11-05", "2026-10-30")).toEqual({ ok: false, refusal: "quotaUsed" });
    expect(decideLeave(records, "2026-10-31", "2026-10-30")).toEqual({
      ok: true,
      change: { kind: "put", record: leave("2026-10-31") },
    });
    expect(decideLeave(records, "2026-11-04", "2026-10-30")).toEqual({ ok: true, change: { kind: "none" } });
  });

  it("does not plan leave too far ahead or over a visited day", () => {
    expect(decideLeave([], "2026-12-01", "2026-10-30")).toEqual({ ok: false, refusal: "dayClosed" });
    expect(decideLeave([visit("2026-10-30")], "2026-10-30", "2026-10-30")).toEqual({ ok: false, refusal: "dayClosed" });
    expect(decideLeave([], "2026-02-30", "2026-01-30")).toEqual({ ok: false, refusal: "dayClosed" });
  });

  it("offers one 补请 within 48 hours of a missed day", () => {
    const records = [visit("2026-10-20"), visit("2026-10-27")];
    expect(summarizeDailyCheckins(records, "2026-10-30").retroDay).toBe("2026-10-29");
    expect(decideLeave(records, "2026-10-28", "2026-10-30")).toEqual({
      ok: true,
      change: { kind: "put", record: leave("2026-10-28", true) },
    });
    expect(decideLeave(records, "2026-10-26", "2026-10-30")).toEqual({ ok: false, refusal: "dayClosed" });

    const afterRetro = [...records, leave("2026-10-29", true)];
    expect(decideLeave(afterRetro, "2026-10-28", "2026-10-30")).toEqual({ ok: false, refusal: "quotaUsed" });
    expect(summarizeDailyCheckins(afterRetro, "2026-10-30").retroDay).toBeNull();
    expect(summarizeDailyCheckins(afterRetro, "2026-10-30").thisMonth.retroLeft).toBe(0);
  });

  it("charges 补请 to the missed day's month and skips days before the first visit", () => {
    const records = [visit("2026-10-30")];
    expect(summarizeDailyCheckins(records, "2026-11-01").retroDay).toBe("2026-10-31");
    expect(decideLeave(records, "2026-10-29", "2026-10-31")).toEqual({ ok: false, refusal: "dayClosed" });
    expect(summarizeDailyCheckins([], "2026-10-30").retroDay).toBeNull();
  });

  it("cancels only today's or coming leave", () => {
    expect(decideCancelLeave([leave("2026-11-02")], "2026-11-02", "2026-10-30")).toEqual({
      ok: true,
      change: { kind: "remove", day: "2026-11-02" },
    });
    expect(decideCancelLeave([leave("2026-10-29", true)], "2026-10-29", "2026-10-30")).toEqual({
      ok: false,
      refusal: "dayClosed",
    });
    expect(decideCancelLeave([visit("2026-10-30")], "2026-10-30", "2026-10-30")).toEqual({
      ok: false,
      refusal: "dayClosed",
    });
    expect(decideCancelLeave([], "2026-11-02", "2026-10-30")).toEqual({ ok: true, change: { kind: "none" } });
  });

  it("accepts the member's local date within a day of the server date", () => {
    const now = new Date("2026-10-30T14:00:00Z");
    expect(acceptsToday("2026-10-29", now)).toBe(true);
    expect(acceptsToday("2026-10-31", now)).toBe(true);
    expect(acceptsToday("2026-11-01", now)).toBe(false);
    expect(acceptsToday("2026-13-01", now)).toBe(false);
  });
});

describe("EngagementApplication daily check-ins", () => {
  const now = () => new Date("2026-10-30T14:00:00Z");

  it("records a visit once and returns the summary", async () => {
    const memory = memoryRepository([visit("2026-10-28")]);
    const app = new EngagementApplication(memory.repository, now);
    const first = await app.recordDailyVisit("account", "2026-10-30");
    const again = await app.recordDailyVisit("account", "2026-10-30");
    expect(first.ok && first.summary.totalVisitDays).toBe(2);
    expect(again.ok && again.summary.visitedToday).toBe(true);
    expect(memory.records()).toHaveLength(2);
  });

  it("refuses a local date far from the server date", async () => {
    const app = new EngagementApplication(memoryRepository().repository, now);
    expect(await app.dailyCheckins("account", "2026-11-05")).toEqual({ ok: false, refusal: "todayOutOfRange" });
  });

  it("takes, refuses and cancels leave", async () => {
    const memory = memoryRepository([visit("2026-10-27")]);
    const app = new EngagementApplication(memory.repository, now);
    const retro = await app.takeDailyLeave("account", "2026-10-29", "2026-10-30");
    expect(retro.ok && retro.summary.thisMonth).toMatchObject({ leaveDays: 1, leaveLeft: 1, retroLeft: 0 });
    const planned = await app.takeDailyLeave("account", "2026-10-31", "2026-10-30");
    expect(planned.ok && planned.summary.thisMonth.leaveLeft).toBe(0);
    expect(await app.takeDailyLeave("account", "2026-10-30", "2026-10-30")).toEqual({ ok: false, refusal: "quotaUsed" });
    const cancelled = await app.cancelDailyLeave("account", "2026-10-31", "2026-10-30");
    expect(cancelled.ok && cancelled.summary.thisMonth.leaveLeft).toBe(1);
  });
});
