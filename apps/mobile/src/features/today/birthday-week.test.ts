import { describe, expect, it } from "vitest";

import type { CalendarDay } from "@/features/calendar/calendar";

import { birthdayWeek } from "./birthday-week";

const day = (date: string, keys: { key: string; what: string }[]): CalendarDay => ({
  day: Number(date.slice(8, 10)),
  date,
  entries: keys.map(({ key, what }) => ({ key, what, date, pandaId: key, slug: key, name: key })),
});

describe("birthdayWeek", () => {
  it("picks the nearest birthday within seven days", () => {
    const days = [
      day("2026-11-03", [{ key: "birthday:a", what: "5 岁生日" }]),
      day("2026-11-07", [{ key: "move:b", what: "抵达" }, { key: "birthday:c", what: "3 岁生日" }]),
      day("2026-11-09", [{ key: "birthday:d", what: "2 岁生日" }]),
    ];
    expect(birthdayWeek(days, "2026-11-04")).toMatchObject({ entry: { key: "birthday:c" }, daysLeft: 3 });
  });

  it("counts today as day 0 and crosses into next month", () => {
    expect(birthdayWeek([day("2026-11-04", [{ key: "birthday:a", what: "1 岁生日" }])], "2026-11-04")?.daysLeft).toBe(0);
    expect(birthdayWeek([day("2026-12-02", [{ key: "birthday:a", what: "1 岁生日" }])], "2026-11-28")?.daysLeft).toBe(4);
  });

  it("is null past the week, and skips a birth day itself", () => {
    expect(birthdayWeek([day("2026-11-11", [{ key: "birthday:a", what: "1 岁生日" }])], "2026-11-04")).toBeNull();
    expect(birthdayWeek([day("2026-11-05", [{ key: "birthday:a", what: "出生" }])], "2026-11-04")).toBeNull();
  });
});
