import { afterEach, describe, expect, it, vi } from "vitest";

import { fameSlugs } from "@/features/onboarding/suggestions";
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
  const heHua = toPandaListItem(summary("he-hua-chengdu", "He Hua", "和花"));
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

  it("puts the best-known pandas first among the same kind of hit", () => {
    const lanLan = toPandaListItem(summary("lan-lan-ueno-1968", "Lan Lan", "兰兰"));
    const mengLanLater = toPandaListItem(summary("mei-lun-beijing", "Mei Lun", "美伦"));
    const items = [lanLan, mengLanLater, ...pandas];
    expect(searchPandas(items, "ml", ["meng-lan"]).map((item) => item.slug)[0]).toBe("meng-lan");
    expect(searchPandas(items, "ml").map((item) => item.slug)[0]).toBe("mei-lun-beijing");
  });

  it("ranks followed pandas above the well-known order", () => {
    const first = toPandaListItem(summary("hai-hua", "Hai Hua", "海花"));
    const items = [heHua, first];
    expect(searchPandas(items, "hh", ["hai-hua", "he-hua-chengdu"]).map((item) => item.slug)).toEqual([
      "hai-hua",
      "he-hua-chengdu",
    ]);
    expect(searchPandas(items, "hh", ["he-hua-chengdu", "hai-hua"]).map((item) => item.slug)).toEqual([
      "he-hua-chengdu",
      "hai-hua",
    ]);
  });

  it("never lets fame lift a weaker kind of hit over a stronger one", () => {
    const byName = toPandaListItem(summary("hhx-star", null, "星"));
    expect(searchPandas([heHua, byName], "hh", ["he-hua-chengdu"])[0]?.slug).toBe(
      "hhx-star",
    );
  });

  it("ranks name hits before initials hits", () => {
    const byInitials = toPandaListItem(summary("hai-hua", "Hai Hua", "海花"));
    const byName = toPandaListItem(summary("hhx-star", null, "星"));
    expect(searchPandas([byInitials, byName], "hh").map((item) => item.slug)).toEqual(["hhx-star", "hai-hua"]);
  });

  it("builds initials from Latin names, not from the extra words of a slug", () => {
    const qizai = toPandaListItem(summary("qizai-qinling", "Qizai", "七仔"));
    const ming = toPandaListItem(summary("ming-london-1938", "Ming", "明"));
    expect(qizai.initials).toEqual([]);
    expect(ming.initials).toEqual([]);
    expect(searchPandas([qizai, ming, ...pandas], "qq")).toEqual([]);
    expect(searchPandas([ming, ...pandas], "ml").map((item) => item.slug)).toEqual(["meng-lan"]);
  });

  it("falls back to the slug only when a panda has no Latin name", () => {
    const rescue = toPandaListItem(summary("hua-hua-wolong-rescue-1983", null, "花花"));
    expect(rescue.initials).toEqual(["hhwr"]);
  });

  it("keeps the popular rank when a panda is also on the well-known list", () => {
    const heYe = toPandaListItem(summary("he-ye-chengdu", "He Ye", "和叶"));
    const heHua = toPandaListItem(summary("he-hua-chengdu", "He Hua", "和花"));
    const famous = fameSlugs([heYe, heHua]);
    expect(searchPandas([heHua, heYe], "he", famous).map((item) => item.slug)).toEqual([
      "he-ye-chengdu",
      "he-hua-chengdu",
    ]);
  });

  it("keeps a popular 和花 ahead of another hh hit", () => {
    const huaHua = toPandaListItem(summary("hua-hua-wolong-rescue-1983", null, "花花"));
    const heHua = toPandaListItem(summary("he-hua-chengdu", "He Hua", "和花"));
    const famous = fameSlugs([heHua, huaHua]);
    expect(searchPandas([huaHua, heHua], "hh", famous).map((item) => item.slug)).toEqual([
      "he-hua-chengdu",
      "hua-hua-wolong-rescue-1983",
    ]);
  });
});
