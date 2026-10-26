import { describe, expect, it } from "vitest";

import { type CalendarEvent, type CalendarPanda, calendarMonth, dayHeading, monthGrid, shiftMonth } from "./calendar";

const panda = (id: string, birthDate: string | null, deceased = false): CalendarPanda => ({
  id,
  slug: `slug-${id}`,
  name: `熊猫${id}`,
  birthDate,
  deceased,
});

const event = (
  eventId: string,
  eventType: string,
  occurredOn: string,
  participantIds: string[],
  occurredPrecision = "day",
): CalendarEvent => ({
  eventId,
  eventType,
  occurredOn,
  occurredPrecision,
  participantIds,
});

describe("calendarMonth", () => {
  it("lists birthdays of living pandas with their age, and 出生 in the birth year", () => {
    const pandas = [
      panda("a", "2020-07-20"),
      panda("b", "2026-07-03"),
      panda("c", "2015-07-20", true),
      panda("d", "2020"),
      panda("e", "2020-08-01"),
    ];
    expect(calendarMonth(pandas, [], 2026, 7)).toEqual([
      {
        day: 3,
        date: "2026-07-03",
        entries: [
          {
            key: "birthday:b",
            date: "2026-07-03",
            slug: "slug-b",
            name: "熊猫b",
            what: "出生",
          },
        ],
      },
      {
        day: 20,
        date: "2026-07-20",
        entries: [
          {
            key: "birthday:a",
            date: "2026-07-20",
            slug: "slug-a",
            name: "熊猫a",
            what: "6 岁生日",
          },
        ],
      },
    ]);
  });

  it("moves a 2-29 birthday to 2-28 outside leap years and skips years before birth", () => {
    expect(calendarMonth([panda("a", "2024-02-29")], [], 2025, 2)[0]?.date).toBe("2025-02-28");
    expect(calendarMonth([panda("a", "2024-02-29")], [], 2028, 2)[0]?.date).toBe("2028-02-29");
    expect(calendarMonth([panda("a", "2024-02-29")], [], 2023, 2)).toEqual([]);
  });

  it("lists day-precise events once per published participant, leaving birth events to birthdays", () => {
    const pandas = [panda("a", null), panda("b", null)];
    const events = [
      event("move", "transfer", "2026-01-28", ["a", "b", "unpublished"]),
      event("born", "birth", "2026-01-05", ["a"]),
      event("vague", "arrival", "2026-01-01", ["a"], "month"),
      event("other-month", "arrival", "2026-02-01", ["a"]),
    ];
    const days = calendarMonth(pandas, events, 2026, 1);
    expect(days).toHaveLength(1);
    expect(days[0]?.entries.map((entry) => `${entry.name} ${entry.what}`)).toEqual(["熊猫a 迁移", "熊猫b 迁移"]);
  });
});

describe("monthGrid", () => {
  it("starts weeks on Monday and pads both ends", () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(weeks.at(-1)).toEqual([26, 27, 28, 29, 30, 31, null]);
  });
});

describe("shiftMonth and dayHeading", () => {
  it("crosses year boundaries", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("names the weekday", () => {
    expect(dayHeading("2026-10-26")).toBe("10月26日 周一");
  });
});
