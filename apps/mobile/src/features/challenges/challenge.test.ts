import { describe, expect, it } from "vitest";

import { EMPTY_STATE, daysLeft, fallbackTitle, parseChallengeState, pastMonths, progress, setJoined, themeFor, toggleTask } from "./challenge";

describe("monthly challenge", () => {
  it("falls back to default tasks and a month title", () => {
    expect(themeFor("2030-03").tasks.length).toBe(4);
    expect(themeFor("2030-03").title).toBeNull();
    expect(fallbackTitle("2030-03")).toBe("三月挑战");
    expect(fallbackTitle("2026-11")).toBe("十一月挑战");
  });
  it("joins, toggles and counts progress", () => {
    let s = setJoined(EMPTY_STATE, "2026-11", true);
    expect(s.joined).toEqual(["2026-11"]);
    s = toggleTask(s, "2026-11", "daily");
    expect(progress(s, "2026-11")).toEqual({ done: 1, total: 4 });
    s = toggleTask(s, "2026-11", "daily");
    expect(progress(s, "2026-11").done).toBe(0);
    expect(setJoined(s, "2026-11", false).joined).toEqual([]);
  });
  it("parses bad storage safely", () => {
    expect(parseChallengeState("{oops")).toEqual(EMPTY_STATE);
    expect(parseChallengeState(JSON.stringify({ joined: ["2026-11", 3], done: { "2026-11": ["a", 1] } }))).toEqual({
      joined: ["2026-11"],
      done: { "2026-11": ["a"] },
    });
  });
  it("counts the days left and lists past months", () => {
    expect(daysLeft("2026-11-04")).toBe(26);
    expect(daysLeft("2028-02-01")).toBe(28);
    let state = setJoined(setJoined(EMPTY_STATE, "2026-09", true), "2026-10", true);
    for (const id of ["daily", "guess", "learn", "checkin"]) state = toggleTask(state, "2026-09", id);
    expect(pastMonths(setJoined(state, "2026-11", true), "2026-11")).toEqual([
      { month: "2026-09", complete: true },
      { month: "2026-10", complete: false },
    ]);
  });
});
