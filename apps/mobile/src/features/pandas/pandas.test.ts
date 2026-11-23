import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPandaIndex, searchPandas, toPandaListItem } from "@/features/pandas/pandas";
import { queryClient } from "@/lib/query-client";

const publicApi = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: publicApi,
}));

afterEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

describe("loadPandaIndex", () => {
  it("builds the panda index from /api/v2/pandas alone without separate residency or place requests", async () => {
    publicApi.GET.mockResolvedValueOnce({
      data: {
        items: [
          {
            pandaId: "p-1",
            canonicalSlug: "bao-li",
            legacySlugs: ["baoli"],
            names: [
              { languageTag: "zh-Hans", nameKind: "official", value: "宝力", isPrimary: true },
              { languageTag: "en", nameKind: "official", value: "Bao Li", isPrimary: true },
            ],
            facts: [
              {
                fieldKey: "sex",
                value: "male",
                status: "confirmed",
                lastVerifiedOn: "2026-10-28",
                conclusionVersion: 1,
              },
              {
                fieldKey: "birth_date",
                value: "2021-08-04",
                status: "confirmed",
                lastVerifiedOn: "2026-10-28",
                conclusionVersion: 1,
              },
            ],
            currentPlace: {
              placeId: "pl-dc",
              slug: "smithsonian-national-zoo",
              placeType: "facility",
              nameZh: "史密森国家动物园",
              countryCode: "US",
              region: "Washington, DC",
            },
            hasFullBleedCover: true,
          },
          {
            pandaId: "p-2",
            canonicalSlug: "fu-bao",
            legacySlugs: [],
            names: [{ languageTag: "zh-Hans", nameKind: "official", value: "福宝", isPrimary: true }],
            facts: [],
          },
        ],
      },
    });

    const items = await loadPandaIndex();

    expect(publicApi.GET).toHaveBeenCalledTimes(1);
    expect(publicApi.GET).toHaveBeenCalledWith("/api/v2/pandas");
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.id === "p-1")).toMatchObject({
      id: "p-1",
      slug: "bao-li",
      name: "宝力",
      sex: "male",
      birthDate: "2021-08-04",
      deceased: false,
      place: "史密森国家动物园",
      placeId: "pl-dc",
      area: "海外",
      hasFullBleedCover: true,
    });
    expect(items.find((item) => item.id === "p-1")?.terms).toContain("史密森国家动物园");
    expect(items.find((item) => item.id === "p-2")?.hasFullBleedCover).toBe(false);
    expect(items.find((item) => item.id === "p-2")?.placeId).toBeNull();
  });
});

const summary = (canonicalSlug: string, latinName: string | null, zhName: string, legacySlugs: string[] = []) =>
  ({
    pandaId: canonicalSlug,
    canonicalSlug,
    legacySlugs,
    names: [
      { languageTag: "zh-Hans", nameKind: "official", value: zhName, isPrimary: true },
      ...(latinName ? [{ languageTag: "en", nameKind: "official", value: latinName, isPrimary: true }] : []),
    ],
    facts: [],
  }) as Parameters<typeof toPandaListItem>[0];

describe("searchPandas by pinyin initials", () => {
  const pandas = [
    toPandaListItem(summary("he-hua-chengdu", "He Hua", "和花")),
    toPandaListItem(summary("meng-lan", "Meng Lan", "萌兰")),
    toPandaListItem(summary("fu-bao", "Fu Bao", "福宝")),
    toPandaListItem(summary("hua-hua-wolong-rescue-1983", null, "花花")),
    toPandaListItem(summary("tiantian", "Tian Tian", "添添")),
    toPandaListItem(summary("ai-bang-2016-cub-66", "Ai Bang's 2016 Cub 66", "爱浜2016仔")),
  ];
  const slugsFor = (query: string) => searchPandas(pandas, query).map((item) => item.slug);

  it("finds 和花 and 花花 by hh", () => {
    expect(slugsFor("hh")).toEqual(["he-hua-chengdu", "hua-hua-wolong-rescue-1983"]);
  });

  it("finds 萌兰 by ml and 福宝 by fb", () => {
    expect(slugsFor("ml")).toEqual(["meng-lan"]);
    expect(slugsFor("FB")).toEqual(["fu-bao"]);
  });

  it("matches initials from the start only", () => {
    expect(slugsFor("hc")).toEqual([]);
    expect(slugsFor("lan")).toEqual(["meng-lan"]);
  });

  it("ignores numbers when building initials", () => {
    expect(slugsFor("abc")).toEqual(["ai-bang-2016-cub-66"]);
    expect(slugsFor("ab2")).toEqual([]);
  });

  it("does not turn a one-word slug into an initial", () => {
    expect(slugsFor("t")).toEqual(["tiantian"]);
    expect(pandas.find((item) => item.slug === "tiantian")?.initials).toEqual(["tt"]);
  });

  it("ranks name hits before initials hits", () => {
    const byInitials = toPandaListItem(summary("hai-hua", "Hai Hua", "海花"));
    const byName = toPandaListItem(summary("hhx-star", null, "星"));
    expect(searchPandas([byInitials, byName], "hh").map((item) => item.slug)).toEqual(["hhx-star", "hai-hua"]);
  });
});
