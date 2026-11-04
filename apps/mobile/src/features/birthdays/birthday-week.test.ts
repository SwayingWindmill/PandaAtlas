import { describe, expect, it } from "vitest";

import { birthdayWeek, followedInWeek, whenLabel } from "./birthday-week";

import { eventsFor } from "./events";

const panda = (id: string, birthDate: string | null, deceased = false) => ({
  id,
  slug: `s-${id}`,
  name: `熊猫${id}`,
  birthDate,
  deceased,
});

describe("birthdayWeek", () => {
  it("lists living pandas whose birthday is in the next seven days, soonest first", () => {
    const week = birthdayWeek(
      [panda("a", "2020-11-10"), panda("b", "2016-11-04"), panda("c", "2019-11-11"), panda("d", "2018-11-05", true)],
      "2026-11-04",
    );
    expect(week.map((entry) => [entry.pandaId, entry.inDays, entry.age])).toEqual([
      ["b", 0, 10],
      ["a", 6, 6],
    ]);
  });

  it("crosses New Year and skips the day a cub was born", () => {
    const week = birthdayWeek([panda("a", "2020-01-02"), panda("b", "2026-12-30")], "2026-12-29");
    expect(week).toEqual([{ date: "2027-01-02", inDays: 4, pandaId: "a", slug: "s-a", name: "熊猫a", age: 7 }]);
  });

  it("tells a 2-29 birthday on 2-28 outside leap years and ignores unknown days", () => {
    const week = birthdayWeek([panda("a", "2016-02-29"), panda("b", "2016-02"), panda("c", null)], "2027-02-25");
    expect(week.map((entry) => entry.date)).toEqual(["2027-02-28"]);
  });
});

describe("labels and reminder", () => {
  it("says when", () => {
    expect([0, 1, 2, 5].map(whenLabel)).toEqual(["今天", "明天", "后天", "5 天后"]);
  });

  it("keeps only followed pandas", () => {
    const week = birthdayWeek([panda("a", "2020-11-05"), panda("b", "2020-11-06")], "2026-11-04");
    expect(followedInWeek(week, new Set(["b"])).map((entry) => entry.pandaId)).toEqual(["b"]);
  });
});
describe("eventsFor", () => {
  it("keeps only https entries for the panda", () => {
    const ev = { pandaSlug: "a", title: "t", source: "s", date: "2026-08-23", checkedOn: "2026-08-01" };
    expect(eventsFor("a", [{ ...ev, url: "https://x" }, { ...ev, url: "http://x" }, { ...ev, pandaSlug: "b", url: "https://y" }])).toHaveLength(1);
  });
});
