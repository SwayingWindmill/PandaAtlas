import { describe, expect, it } from "vitest";

import type { LifeEvent } from "../timeline/timeline";

import { parseYear, reviewYears, yearReview } from "./year-review";

const panda = (id: string, birthDate: string | null, deceased = false) => ({ id, slug: `s-${id}`, name: `熊猫${id}`, birthDate, deceased });
const event = (over: Partial<LifeEvent>): LifeEvent => ({
  eventId: "e1",
  eventType: "arrival",
  eventStatus: "completed",
  occurredOn: "2026-03-01",
  occurredPrecision: "day",
  participantIds: ["a"],
  sourceIds: ["src"],
  ...over,
});
const places = new Map([
  ["us", { name: "史密森国家动物园", countryCode: "US" }],
  ["cn", { name: "碧峰峡基地", countryCode: "CN" }],
]);

describe("yearReview", () => {
  it("counts births, birthdays up to today and sourced moves", () => {
    const review = yearReview({
      year: 2026,
      today: "2026-06-30",
      pandas: [panda("a", "2020-05-01"), panda("b", "2026-02-10"), panda("c", "2019-08-01"), panda("d", "2010-01-01", true)],
      events: [
        event({}),
        event({ eventId: "e2", eventType: "transfer", fromPlaceId: "us", toPlaceId: "cn", participantIds: ["c"] }),
        event({ eventId: "e3", sourceIds: [] }),
        event({ eventId: "e4", occurredOn: "2026-09-01" }),
        event({ eventId: "e5", eventStatus: "announced" }),
      ],
      places,
    });
    expect(review.partial).toBe(true);
    expect(review.births.map((p) => p.id)).toEqual(["b"]);
    expect(review.birthdays).toBe(1);
    expect(review.moves.map((m) => [m.pandaId, m.text, m.home])).toEqual([
      ["a", "抵达新家", false],
      ["c", "回国，住进碧峰峡基地", true],
    ]);
    expect(review.homecomings).toBe(1);
  });

  it("restricts to one panda and reports an empty year", () => {
    const review = yearReview({ year: 2024, today: "2026-11-04", pandas: [panda("a", "2020-05")], events: [event({})], places, pandaId: "a" });
    expect(review.partial).toBe(false);
    expect(review.empty).toBe(true);
  });
});

describe("years", () => {
  it("offers this year and three before, and rejects others", () => {
    expect(reviewYears("2026-11-04")).toEqual([2026, 2025, 2024, 2023]);
    expect(parseYear("2024", "2026-11-04")).toBe(2024);
    expect(parseYear("1999", "2026-11-04")).toBe(2026);
    expect(parseYear(undefined, "2026-11-04")).toBe(2026);
  });
});
