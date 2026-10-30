import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ authedApi: {} }));

const { cancellable, dayMark, leaveLeftIn, rulesNote, upcomingLeave, visitsIn, weekOf } = await import("./checkin");

const rules = { leaveDaysPerMonth: 2, retroLeavesPerMonth: 1, retroWindowHours: 48, leaveAheadDays: 31 };
const summary = {
  today: "2026-10-30",
  rules,
  visitedToday: true,
  totalVisitDays: 3,
  firstDay: "2026-09-30",
  thisMonth: { month: "2026-10", visitDays: 2, leaveDays: 1, leaveLeft: 1, retroLeft: 1 },
  retroDay: "2026-10-28",
  days: [
    { day: "2026-09-30", kind: "visit" as const, retroactive: false },
    { day: "2026-10-27", kind: "visit" as const, retroactive: false },
    { day: "2026-10-30", kind: "visit" as const, retroactive: false },
    { day: "2026-10-31", kind: "leave" as const, retroactive: false },
    { day: "2026-11-03", kind: "leave" as const, retroactive: false },
    { day: "2026-11-04", kind: "leave" as const, retroactive: false },
  ],
};

describe("daily check-in", () => {
  it("starts the week on Monday", () => {
    expect(weekOf("2026-10-30")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("marks visits, leave, the 补请 day and days that can still be planned", () => {
    expect(dayMark(summary, "2026-10-30")).toBe("visit");
    expect(dayMark(summary, "2026-10-31")).toBe("leave");
    expect(dayMark(summary, "2026-10-28")).toBe("retro");
    expect(dayMark(summary, "2026-10-29")).toBe("none");
    expect(dayMark(summary, "2026-11-05")).toBe("none");
    expect(dayMark(summary, "2026-12-01")).toBe("none");
    expect(leaveLeftIn(summary, "2026-10")).toBe(1);
    expect(leaveLeftIn(summary, "2026-11")).toBe(0);
    expect(visitsIn(summary, "2026-10")).toBe(2);
  });

  it("lets only today's or coming leave be taken back", () => {
    expect(cancellable(summary, "2026-10-31")).toBe(true);
    expect(cancellable(summary, "2026-10-30")).toBe(false);
    expect(upcomingLeave(summary)).toEqual(["2026-10-31", "2026-11-03", "2026-11-04"]);
  });

  it("states the rules from the API's numbers without streak words", () => {
    const note = rulesNote(rules);
    expect(note).toContain("2 天假");
    expect(note).toContain("48 小时内");
    expect(note).not.toMatch(/连续|断签|清零了|可惜/);
  });
});
