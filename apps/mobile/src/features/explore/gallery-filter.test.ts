import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";
import type { SpecialChips } from "@/features/pandas/special-chips";

import { availableGalleryTabs, pickFeaturedPanda, pickGalleryPandas, pickStarStrip } from "./gallery-filter";

function makePanda(
  slug: string,
  opts: Partial<Pick<PandaListItem, "area" | "hasFullBleedCover" | "deceased">> = {},
): PandaListItem {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    sex: null,
    birthDate: "2020-07-04",
    deceased: opts.deceased ?? false,
    place: opts.area === "海外" ? "史密森国家动物园" : "成都大熊猫基地",
    placeId: null,
    area: opts.area ?? "成都",
    hasFullBleedCover: opts.hasFullBleedCover ?? false,
    terms: [slug],
    initials: [],
  };
}

const SPECIAL: SpecialChips = {
  双胞胎: new Set(["he-hua-chengdu", "he-ye-chengdu"]),
  归国: new Set(["xiang-xiang", "xiao-xiao"]),
};

describe("pickStarStrip", () => {
  it("prioritizes curated star pandas and excludes deceased pandas", () => {
    const pandas = [
      makePanda("random-one", { hasFullBleedCover: true }),
      makePanda("meng-lan"),
      makePanda("he-hua-chengdu"),
      makePanda("fu-bao", { deceased: true }),
    ];
    expect(pickStarStrip(pandas, [], 10).map((p) => p.slug)).toEqual([
      "he-hua-chengdu",
      "meng-lan",
      "random-one",
    ]);
  });
});

describe("pickFeaturedPanda", () => {
  it("prefers curated stars with full-bleed covers deterministically by day", () => {
    const pandas = [
      makePanda("random-one", { hasFullBleedCover: true }),
      makePanda("meng-lan", { hasFullBleedCover: false }),
      makePanda("xiang-xiang", { hasFullBleedCover: true }),
      makePanda("bao-li", { hasFullBleedCover: true, area: "海外" }),
    ];
    const first = pickFeaturedPanda(pandas, "2026-11-23");
    const second = pickFeaturedPanda([...pandas].reverse(), "2026-11-23");
    expect(first?.slug).toBe(second?.slug);
    expect(["xiang-xiang", "bao-li"]).toContain(first?.slug);
  });
});

describe("availableGalleryTabs and pickGalleryPandas", () => {
  const pandas = [
    makePanda("he-hua-chengdu"),
    makePanda("he-ye-chengdu"),
    makePanda("bao-li", { area: "海外", hasFullBleedCover: true }),
    makePanda("xiang-xiang", { hasFullBleedCover: true }),
    makePanda("xiao-xiao", { hasFullBleedCover: true }),
  ];

  it("hides filter tabs without matches and filters each category cleanly", () => {
    expect(availableGalleryTabs(pandas, SPECIAL)).toEqual(["精选", "双胞胎", "在海外", "已归国"]);
    expect(availableGalleryTabs(pandas, { 双胞胎: new Set(), 归国: new Set() })).toEqual(["精选", "在海外"]);

    const twins = pickGalleryPandas(pandas, "双胞胎", SPECIAL, "2026-11-23", 4).map((p) => p.slug);
    expect(twins.sort()).toEqual(["he-hua-chengdu", "he-ye-chengdu"]);

    const overseas = pickGalleryPandas(pandas, "在海外", SPECIAL, "2026-11-23", 4).map((p) => p.slug);
    expect(overseas).toEqual(["bao-li"]);

    const returned = pickGalleryPandas(pandas, "已归国", SPECIAL, "2026-11-23", 4).map((p) => p.slug);
    expect(returned.sort()).toEqual(["xiang-xiang", "xiao-xiao"]);
  });
});
