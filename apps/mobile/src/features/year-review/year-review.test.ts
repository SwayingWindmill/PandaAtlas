import { describe, expect, it } from "vitest";

import { monthDot, parseYear, reviewYears, yearReview } from "./year-review";

const base = {
  year: 2026,
  today: "2026-11-04",
  games: [
    { pandaId: "a", firstGame: "daily_panda" as const, firstMetAt: "2026-03-14T09:00:00Z", timesMet: 4 },
    { pandaId: "b", firstGame: "guess_panda" as const, firstMetAt: "2025-12-30T09:00:00Z", timesMet: 1 },
  ],
  seen: [
    { pandaId: "c", seenOn: "2026-07-02", placeId: "p1", firstSeenAt: "2026-07-02T10:00:00Z" },
    { pandaId: "d", seenOn: null, placeId: null, firstSeenAt: "2026-02-01T10:00:00Z" },
  ],
  visits: [
    { placeId: "p1", visitedOn: "2026-07-02" },
    { placeId: "p1", visitedOn: "2026-08-10" },
    { placeId: "p2", visitedOn: "2025-05-01" },
  ],
  checkins: [
    { day: "2026-08-01", kind: "visit" },
    { day: "2026-08-02", kind: "visit" },
    { day: "2026-01-05", kind: "visit" },
    { day: "2026-01-06", kind: "leave" },
    { day: "2025-08-01", kind: "visit" },
  ],
};

describe("year review", () => {
  it("counts the year's own records", () => {
    const review = yearReview(base);
    expect(review.seen).toBe(2);
    expect(review.recognized).toBe(1);
    expect(review.checkinDays).toBe(3);
    expect(review.places).toBe(1);
    expect(review.months[0]).toBe(1);
    expect(review.months[7]).toBe(2);
    expect(review.busiest).toBe(8);
    expect(review.partial).toBe(true);
    expect(review.empty).toBe(false);
  });

  it("lists the firsts oldest first and takes the first panda met", () => {
    const review = yearReview(base);
    expect(review.firsts.map((item) => `${item.kind}:${item.date}`)).toEqual([
      "checkin:2026-01-05",
      "seen:2026-02-01",
      "recognized:2026-03-14",
      "visit:2026-07-02",
    ]);
    expect(review.first).toEqual({ pandaId: "d", date: "2026-02-01" });
  });

  it("is empty for a year with nothing, and not partial once it is over", () => {
    const review = yearReview({ ...base, year: 2024 });
    expect(review.empty).toBe(true);
    expect(review.busiest).toBeNull();
    expect(review.first).toBeNull();
    expect(yearReview({ ...base, year: 2025 }).partial).toBe(false);
  });

  it("ignores what comes after today", () => {
    expect(yearReview({ ...base, today: "2026-07-01" }).places).toBe(0);
  });

  it("accepts only the recent years", () => {
    expect(reviewYears("2026-11-04")).toEqual([2026, 2025, 2024, 2023]);
    expect(parseYear("2025", "2026-11-04")).toBe(2025);
    expect(parseYear("2019", "2026-11-04")).toBe(2026);
    expect(monthDot("2026-03-14")).toBe("03.14");
  });
});
