import { describe, expect, it } from "vitest";

import { baseGroups, buildLifeList, entryDetail, familyGroups, filterEntries, groupProgress, monthDay } from "./book";

describe("buildLifeList", () => {
  const list = buildLifeList(
    [
      { pandaId: "fu-bao", firstGame: "daily_panda", firstMetAt: "2026-07-20T08:00:00Z", timesMet: 3 },
      { pandaId: "meng-lan", firstGame: "guess_panda", firstMetAt: "2026-09-09T08:00:00Z", timesMet: 1 },
    ],
    [
      { pandaId: "he-hua", seenOn: "2026-07-12", placeId: "chengdu", firstSeenAt: "2026-07-12T10:00:00Z" },
      { pandaId: "meng-lan", seenOn: "2026-07-30", placeId: null, firstSeenAt: "2026-07-30T10:00:00Z" },
    ],
  );

  it("lists each panda once, newest first, numbered in the order they were first met", () => {
    expect(list.entries.map((entry) => [entry.pandaId, entry.number, entry.firstOn])).toEqual([
      ["meng-lan", 3, "2026-07-30"],
      ["fu-bao", 2, "2026-07-20"],
      ["he-hua", 1, "2026-07-12"],
    ]);
  });

  it("counts 见过 and 认出 separately, so one panda can be both", () => {
    expect([list.seenCount, list.recognizedCount]).toEqual([2, 2]);
    expect(filterEntries(list.entries, "seen").map((entry) => entry.pandaId)).toEqual(["meng-lan", "he-hua"]);
    expect(filterEntries(list.entries, "recognized").map((entry) => entry.pandaId)).toEqual(["meng-lan", "fu-bao"]);
  });

  it("falls back to when a 见过 was recorded when it has no day", () => {
    const only = buildLifeList([], [{ pandaId: "a", seenOn: null, firstSeenAt: "2026-10-26T01:00:00Z" }]);
    expect(only.entries[0]!.firstOn).toBe("2026-10-26");
  });

  it("says when and where, and how often a game brought it back", () => {
    const names = (id: string) => (id === "chengdu" ? "成都基地" : null);
    const [mengLan, fuBao, heHua] = list.entries;
    expect(entryDetail(heHua!, names)).toBe("7月12日在成都基地见过");
    expect(entryDetail(fuBao!, names)).toBe("7月20日每日一猫认出，遇到 3 次");
    expect(entryDetail(mengLan!, names)).toBe("7月30日见过 · 9月9日猜熊猫认出");
    expect(monthDay("2026-01-05")).toBe("1月5日");
  });
});

describe("baseGroups", () => {
  const places = new Map([
    ["cd", { slug: "chengdu", placeType: "facility", name: "成都基地" }],
    ["bfx", { slug: "bifengxia", placeType: "facility", name: "碧峰峡" }],
    ["ueno", { slug: "ueno", placeType: "facility", name: "上野动物园" }],
    ["cn", { slug: "china", placeType: "coarse_location", name: "中国" }],
  ]);
  const groups = baseGroups(
    [
      { id: "a", placeId: "cd" },
      { id: "b", placeId: "cd" },
      { id: "c", placeId: "bfx" },
      { id: "d", placeId: "cn" },
      { id: "e", placeId: null },
    ],
    places,
    new Set(["a"]),
    [
      { placeId: "ueno", visitedOn: "2025-04-03" },
      { placeId: "cd", visitedOn: "2025-12-31" },
      { placeId: "cd", visitedOn: "2026-10-26" },
    ],
  );

  it("counts only the pandas living at a base now, and keeps places visited with nobody left", () => {
    expect(groups.map((group) => [group.title, group.known, group.members.length, group.visitedOn])).toEqual([
      ["成都基地", 1, 2, "2026-10-26"],
      ["上野动物园", 0, 0, "2025-04-03"],
      ["碧峰峡", 0, 1, null],
    ]);
  });

  it("says how far along a group is", () => {
    expect(groupProgress(groups[0]!)).toBe("认识 1/2 只");
    expect(groupProgress(groups[1]!)).toBe("现在没有熊猫住在这里");
    expect(groupProgress({ known: 2, members: ["a", "b"] })).toBe("2 只全部认识");
  });
});

describe("familyGroups", () => {
  const pandas = new Map(
    ["添添", "美香", "宝宝", "宝力", "泰山", "伦伦", "喜伦"].map((name) => [name, { name, slug: `slug-${name}` }]),
  );
  const groups = familyGroups(
    [
      { childId: "宝宝", parentId: "添添" },
      { childId: "宝宝", parentId: "美香" },
      { childId: "泰山", parentId: "美香" },
      { childId: "宝力", parentId: "宝宝" },
      { childId: "喜伦", parentId: "伦伦" },
      { childId: "喜伦", parentId: "unpublished" },
    ],
    pandas,
    new Set(["宝力", "喜伦"]),
  );

  it("joins parents and children into families named by the eldest generation", () => {
    expect(groups.map((group) => [group.title, group.members.length, group.known])).toEqual([
      ["伦伦家", 2, 1],
      ["美香和添添家", 5, 1],
    ]);
    expect(groups[1]!.slug).toBe("slug-美香");
  });
});
