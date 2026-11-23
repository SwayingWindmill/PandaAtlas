import { describe, expect, it, vi } from "vitest";

import { buildFindChips, matchesFindChip } from "./find-filter";

vi.mock("@/lib/api", () => ({
  api: {},
}));

const EMPTY_SPECIAL = { 双胞胎: new Set<string>(), 归国: new Set<string>() };

describe("find-filter", () => {
  const pandas = [
    { slug: "he-hua", area: "成都", deceased: false, hasFullBleedCover: true },
    { slug: "bao-li", area: "海外", deceased: false, hasFullBleedCover: false },
    { slug: "tuantuan", area: "海外", deceased: true, hasFullBleedCover: true },
  ];

  it("orders status, photo, region, special, and area chips and hides empty filters", () => {
    const special = { 双胞胎: new Set(["he-hua"]), 归国: new Set<string>() };
    expect(buildFindChips(pandas, special)).toEqual(["在世", "有照片", "在中国", "在海外", "双胞胎", "成都"]);

    const bare = [{ slug: "old", area: null, deceased: true, hasFullBleedCover: false }];
    expect(buildFindChips(bare, EMPTY_SPECIAL)).toEqual([]);
  });

  it("filters accurately by living status, photo presence, region, area, and special tags", () => {
    const special = { 双胞胎: new Set(["he-hua"]), 归国: new Set(["bao-li"]) };
    expect(pandas.filter((p) => matchesFindChip(p, "全部", special)).map((p) => p.slug)).toEqual([
      "he-hua",
      "bao-li",
      "tuantuan",
    ]);
    expect(pandas.filter((p) => matchesFindChip(p, "在世", special)).map((p) => p.slug)).toEqual(["he-hua", "bao-li"]);
    expect(pandas.filter((p) => matchesFindChip(p, "有照片", special)).map((p) => p.slug)).toEqual([
      "he-hua",
      "tuantuan",
    ]);
    expect(pandas.filter((p) => matchesFindChip(p, "在中国", special)).map((p) => p.slug)).toEqual(["he-hua"]);
    expect(pandas.filter((p) => matchesFindChip(p, "在海外", special)).map((p) => p.slug)).toEqual([
      "bao-li",
      "tuantuan",
    ]);
    expect(pandas.filter((p) => matchesFindChip(p, "成都", special)).map((p) => p.slug)).toEqual(["he-hua"]);
    expect(pandas.filter((p) => matchesFindChip(p, "归国", special)).map((p) => p.slug)).toEqual(["bao-li"]);
  });
});
