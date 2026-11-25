import type { components } from "@zhipanda/api-client";
import { describe, expect, it, vi } from "vitest";

import type { MapItem } from "@/features/map/model";

import {
  buildFindChips,
  filterPandas,
  filterPandasMulti,
  hasActiveFindFilter,
  matchFindVenues,
  matchesFindChip,
  toggleFindChip,
} from "./find-filter";

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

  it("combines location chips with OR, attribute chips with AND, and both together", () => {
    const pool = [
      { slug: "he-hua", area: "成都", deceased: false, hasFullBleedCover: true },
      { slug: "he-ye", area: "成都", deceased: false, hasFullBleedCover: false },
      { slug: "fu-bao", area: "卧龙", deceased: false, hasFullBleedCover: true },
      { slug: "old-wolong", area: "卧龙", deceased: true, hasFullBleedCover: true },
      { slug: "meng-lan", area: "北京", deceased: false, hasFullBleedCover: true },
      { slug: "xiang-xiang", area: "海外", deceased: false, hasFullBleedCover: true },
    ];
    const special = {
      双胞胎: new Set(["he-hua", "he-ye"]),
      归国: new Set(["fu-bao"]),
    };

    // OR across location chips
    expect(filterPandasMulti(pool, ["成都", "卧龙"], special).map((p) => p.slug)).toEqual([
      "he-hua",
      "he-ye",
      "fu-bao",
      "old-wolong",
    ]);
    expect(filterPandasMulti(pool, ["北京", "在海外"], special).map((p) => p.slug)).toEqual([
      "meng-lan",
      "xiang-xiang",
    ]);

    // AND across attribute chips
    expect(filterPandasMulti(pool, ["在世", "有照片"], special).map((p) => p.slug)).toEqual([
      "he-hua",
      "fu-bao",
      "meng-lan",
      "xiang-xiang",
    ]);
    expect(filterPandasMulti(pool, ["在世", "有照片", "双胞胎"], special).map((p) => p.slug)).toEqual(["he-hua"]);

    // OR locations + AND attributes
    expect(filterPandasMulti(pool, ["成都", "卧龙", "在世", "有照片"], special).map((p) => p.slug)).toEqual([
      "he-hua",
      "fu-bao",
    ]);
    expect(filterPandasMulti(pool, ["成都", "卧龙", "归国"], special).map((p) => p.slug)).toEqual(["fu-bao"]);

    // Backwards-compatible filterPandas accepts single string or array
    expect(filterPandas(pool, "全部", special)).toHaveLength(pool.length);
    expect(filterPandas(pool, "成都", special).map((p) => p.slug)).toEqual(["he-hua", "he-ye"]);
    expect(filterPandas(pool, ["在世", "双胞胎"], special).map((p) => p.slug)).toEqual(["he-hua", "he-ye"]);
  });

  it("toggles chips and resets when selecting 全部", () => {
    let selected: string[] = [];
    expect(hasActiveFindFilter(selected)).toBe(false);

    selected = toggleFindChip(selected, "在中国");
    expect(selected).toEqual(["在中国"]);
    expect(hasActiveFindFilter(selected)).toBe(true);

    selected = toggleFindChip(selected, "双胞胎");
    expect(selected).toEqual(["在中国", "双胞胎"]);

    selected = toggleFindChip(selected, "在中国");
    expect(selected).toEqual(["双胞胎"]);

    selected = toggleFindChip(selected, "全部");
    expect(selected).toEqual([]);
    expect(hasActiveFindFilter(selected)).toBe(false);
  });

  it("matches venues by Chinese name, English name, slug, and country with covered lead residents", () => {
    type Inst = components["schemas"]["PublicInstitutionSummaryDto"];
    const institutions: Inst[] = [
      {
        institutionId: "inst-cd",
        slug: "chengdu-research-base",
        nameZh: "成都大熊猫繁育研究基地",
        nameEn: "Chengdu Research Base",
        countryCode: "CN",
        profile: { kind: "breeding_center", verifiedOn: "2026-10-01", sourceUrls: [], liveCamUrl: "https://ipanda.com" },
      },
      {
        institutionId: "inst-bj",
        slug: "beijing-zoo",
        nameZh: "北京动物园",
        nameEn: "Beijing Zoo",
        countryCode: "CN",
        profile: { kind: "zoo", verifiedOn: "2026-10-01", sourceUrls: [] },
      },
      {
        institutionId: "inst-ev",
        slug: "everland",
        nameZh: "爱宝乐园",
        nameEn: "Everland",
        countryCode: "KR",
        profile: { kind: "zoo", verifiedOn: "2026-10-01", sourceUrls: [] },
      },
    ];
    const mapItems: MapItem[] = [
      {
        id: "institution:inst-cd",
        kind: "institution",
        slug: "chengdu-research-base",
        name: "成都大熊猫繁育研究基地",
        where: "中国",
        overseas: false,
        residentCount: 20,
        residentNames: "和叶、和花",
        residents: [
          { id: "p-heye", slug: "he-ye", name: "和叶", hasFullBleedCover: false },
          { id: "p-hehua", slug: "he-hua", name: "和花", hasFullBleedCover: true },
        ],
        point: null,
        placeIds: ["pl-cd"],
        coordinates: null,
      },
      {
        id: "institution:inst-bj",
        kind: "institution",
        slug: "beijing-zoo",
        name: "北京动物园",
        where: "中国",
        overseas: false,
        residentCount: 8,
        residentNames: "萌兰",
        residents: [{ id: "p-ml", slug: "meng-lan", name: "萌兰", hasFullBleedCover: true }],
        point: null,
        placeIds: ["pl-bj"],
        coordinates: null,
      },
    ];

    expect(matchFindVenues(institutions, mapItems, "成都")).toEqual([
      {
        slug: "chengdu-research-base",
        name: "成都大熊猫繁育研究基地",
        countryLabel: "中国",
        kindLabel: "繁育研究基地",
        liveCamUrl: "https://ipanda.com",
        residentCount: 20,
        leadPanda: { id: "p-hehua", name: "和花" },
      },
    ]);
    expect(matchFindVenues(institutions, mapItems, "everland").map((v) => v.slug)).toEqual(["everland"]);
    expect(matchFindVenues(institutions, mapItems, "北京").map((v) => v.slug)).toEqual(["beijing-zoo"]);
    expect(matchFindVenues(institutions, mapItems, "动物园").map((v) => v.slug)).toEqual(["beijing-zoo", "everland"]);
    expect(matchFindVenues(institutions, mapItems, "韩国").map((v) => v.slug)).toEqual(["everland"]);
    expect(matchFindVenues(institutions, mapItems, "#1237")).toEqual([]);
  });
});
