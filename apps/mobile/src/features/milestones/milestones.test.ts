import { describe, expect, it } from "vitest";

import {
  MILESTONE_CONFIG,
  addDays,
  addMonths,
  cubDayOn,
  milestoneNumbers,
  pandaMilestones,
  personalMilestones,
  visitNumbers,
  visitTitle,
} from "./milestones";

describe("addMonths and addDays", () => {
  it("lands on the month's last day when the month is shorter", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2025-12-15", 1)).toBe("2026-01-15");
  });

  it("counts days across months and years", () => {
    expect(addDays("2026-06-03", 100)).toBe("2026-09-11");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("cubDayOn", () => {
  it("is 满月 a month after the birth and 满百天 100 days after", () => {
    expect(cubDayOn("2026-06-03", "2026-07-03")).toBe("month");
    expect(cubDayOn("2026-06-03", "2026-09-11")).toBe("hundred");
    expect(cubDayOn("2026-06-03", "2026-09-10")).toBeNull();
  });

  it("needs the day of birth", () => {
    expect(cubDayOn("2026-06", "2026-07-03")).toBeNull();
    expect(cubDayOn(null, "2026-07-03")).toBeNull();
  });
});

describe("visitNumbers", () => {
  it("numbers each place's visits by day, then by when they were recorded", () => {
    const numbers = visitNumbers([
      { checkinId: "c3", placeId: "ueno", visitedOn: "2026-05-01" },
      { checkinId: "c1", placeId: "ueno", visitedOn: "2025-05-01" },
      { checkinId: "c2b", placeId: "ueno", visitedOn: "2025-06-01", createdAt: "2025-06-01T10:00:00Z" },
      { checkinId: "c2a", placeId: "ueno", visitedOn: "2025-06-01", createdAt: "2025-06-01T09:00:00Z" },
      { checkinId: "d1", placeId: "chengdu", visitedOn: "2026-01-01" },
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ c1: 1, c2a: 2, c2b: 3, c3: 4, d1: 1 });
  });

  it("says the first time back as 回到", () => {
    expect(visitTitle(1, "上野动物园")).toBe("第一次来到上野动物园");
    expect(visitTitle(2, "上野动物园")).toBe("第一次回到上野动物园");
    expect(visitTitle(5, "上野动物园")).toBe("第 5 次来到上野动物园");
  });
});

describe("personalMilestones", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    pandaId: `p${index + 1}`,
    number: index + 1,
    firstOn: `2026-0${index < 9 ? 1 : 2}-${String((index % 9) + 10)}T08:00:00Z`,
  }));
  const panda = (id: string) => ({ name: `熊猫${id}`, slug: `slug-${id}` });
  const place = (id: string) => (id === "nameless" ? { name: null, slug: null } : { name: "上野动物园", slug: id });

  it("marks the configured numbers only, newest first", () => {
    const out = personalMilestones({ entries, visits: [], panda, place });
    expect(out.map((item) => item.title)).toEqual(["第 10 只熊猫", "第一只熊猫"]);
    expect(out[0]).toMatchObject({ date: "2026-02-10", subject: { kind: "panda", id: "p10", slug: "slug-p10" } });
  });

  it("marks the first time back and the 5th at a place, not the first visit", () => {
    const visits = Array.from({ length: 6 }, (_, index) => ({
      checkinId: `c${index}`,
      placeId: "ueno",
      visitedOn: `2026-03-0${index + 1}`,
    }));
    const out = personalMilestones({ entries: [], visits, panda, place });
    expect(out.map((item) => item.title)).toEqual(["第 5 次来到上野动物园", "第一次回到上野动物园"]);
  });

  it("leaves out a place with no name to say", () => {
    const visits = [
      { checkinId: "c1", placeId: "nameless", visitedOn: "2026-03-01" },
      { checkinId: "c2", placeId: "nameless", visitedOn: "2026-03-02" },
    ];
    expect(personalMilestones({ entries: [], visits, panda, place })).toEqual([]);
  });

  it("keeps every number in one config, with no goal past the counts", () => {
    expect(MILESTONE_CONFIG.pandas).toEqual([1, 10, 50, 100, 200]);
    expect(Object.fromEntries(milestoneNumbers(entries))).toEqual({ p1: 1, p10: 10 });
  });
});

describe("pandaMilestones", () => {
  const born = { birthDate: "2020-07-20", birthSourceIds: ["src-birth"], children: [] };

  it("tells 满月, 满百天 and the configured birthdays that have come, with the birth's sources", () => {
    const out = pandaMilestones({ ...born, today: "2030-07-20" });
    expect(out.map((item) => [item.kind, item.date, item.text])).toEqual([
      ["month", "2020-08-20", "满月"],
      ["hundred", "2020-10-28", "满百天"],
      ["age", "2021-07-20", "1 岁生日"],
      ["age", "2030-07-20", "10 岁生日"],
    ]);
    expect(out.every((item) => item.sourceIds[0] === "src-birth" && item.note === "按出生日期推算")).toBe(true);
  });

  it("stops at the death date", () => {
    const out = pandaMilestones({ ...born, today: "2026-10-30", deathDate: "2020-09-30" });
    expect(out.map((item) => item.kind)).toEqual(["month"]);
  });

  it("needs a day of birth", () => {
    expect(pandaMilestones({ ...born, birthDate: "2020-07", today: "2026-10-30" })).toEqual([]);
  });

  it("is a parent from the first cub with a dated birth and a sourced link, twins together", () => {
    const out = pandaMilestones({
      ...born,
      birthDate: null,
      today: "2026-10-30",
      children: [
        { id: "c3", name: "晓晓", birthDate: "2021-06-23", role: "mother", sourceIds: ["src-l1"] },
        { id: "c4", name: "蕾蕾", birthDate: "2021-06-23", role: "mother", sourceIds: ["src-l2"] },
        { id: "c5", name: "无出处", birthDate: "2019-01-01", role: "mother", sourceIds: [] },
        { id: "c6", name: "日期不详", birthDate: "2018", role: "mother", sourceIds: ["src-l3"] },
      ],
    });
    expect(out).toEqual([
      expect.objectContaining({
        kind: "parent",
        date: "2021-06-23",
        text: "当妈妈了，蕾蕾和晓晓出生",
        sourceIds: ["src-l2", "src-l1"],
      }),
    ]);
  });

  it("says nothing of a cub not yet born on the day", () => {
    const children = [{ id: "c", name: "幼崽", birthDate: "2027-01-01", role: "father" as const, sourceIds: ["s"] }];
    expect(pandaMilestones({ ...born, birthDate: null, today: "2026-10-30", children })).toEqual([]);
  });
});
