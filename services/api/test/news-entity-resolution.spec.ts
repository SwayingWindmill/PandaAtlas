import { describe, expect, it } from "vitest";
import {
  createNewsEntityResolver,
  type EntityReferenceCatalog,
} from "../src/modules/news/application/news-entity-resolution.js";

function catalogFixture(): EntityReferenceCatalog {
  return {
    institutions: [
      {
        institutionId: "inst-chengdu",
        slug: "chengdu-research-base",
        nameZh: "成都大熊猫繁育研究基地",
        nameEn: "Chengdu Research Base",
        profile: {
          kind: "breeding_center",
          websiteUrl: "https://www.panda.org.cn/cn/",
          verifiedOn: "2026-11-01",
          sourceUrls: ["https://www.panda.org.cn/cn/"],
        },
      },
      {
        institutionId: "inst-ccrcgp",
        slug: "ccrcgp",
        nameZh: "中国大熊猫保护研究中心",
        nameEn: "CCRCGP",
      },
      {
        institutionId: "inst-ueno",
        slug: "ueno-zoo",
        nameZh: "东京上野动物园",
        nameEn: "Ueno Zoo",
      },
      {
        institutionId: "inst-cq",
        slug: "chongqing-zoo",
        nameZh: "重庆动物园",
        nameEn: "Chongqing Zoo",
      },
      {
        institutionId: "inst-everland",
        slug: "everland",
        nameZh: "三星爱宝乐园",
        nameEn: "Everland",
      },
    ],
    places: [
      { placeId: "pl-cd", institutionId: "inst-chengdu", slug: "chengdu-base", placeType: "facility" },
      { placeId: "pl-ueno", institutionId: "inst-ueno", slug: "ueno-panda-house", placeType: "facility" },
      { placeId: "pl-cq", institutionId: "inst-cq", slug: "cq-panda-house", placeType: "facility" },
      { placeId: "pl-ccrcgp", institutionId: "inst-ccrcgp", slug: "shenshuping", placeType: "facility" },
    ],
    pandas: [
      {
        pandaId: "p-hehua",
        canonicalSlug: "he-hua-chengdu",
        legacySlugs: ["he-hua"],
        names: [{ languageTag: "zh-CN", nameKind: "primary", value: "和花", isPrimary: true }],
        facts: [],
        currentPlace: { placeId: "pl-cd", slug: "chengdu-base", placeType: "facility" },
      },
      {
        pandaId: "p-xiaoxiao-ueno",
        canonicalSlug: "xiao-xiao-ueno-2021",
        legacySlugs: [],
        names: [{ languageTag: "zh-CN", nameKind: "primary", value: "晓晓", isPrimary: true }],
        facts: [],
        currentPlace: { placeId: "pl-ueno", slug: "ueno-panda-house", placeType: "facility" },
      },
      {
        pandaId: "p-xiaoxiao-cq",
        canonicalSlug: "xiao-xiao-chongqing-2019",
        legacySlugs: [],
        names: [{ languageTag: "zh-CN", nameKind: "primary", value: "晓晓", isPrimary: true }],
        facts: [],
        currentPlace: { placeId: "pl-cq", slug: "cq-panda-house", placeType: "facility" },
      },
      {
        pandaId: "p-shubao-dom",
        canonicalSlug: "shu-bao-qinqin-twin-2022",
        legacySlugs: [],
        names: [{ languageTag: "zh-CN", nameKind: "primary", value: "蜀宝", isPrimary: true }],
        facts: [],
        currentPlace: { placeId: "pl-ccrcgp", slug: "shenshuping", placeType: "facility" },
      },
    ],
    residencies: [
      {
        residencyId: "r1",
        pandaId: "p-xiaoxiao-ueno",
        placeId: "pl-ueno",
        residencyType: "primary",
        startOn: "2021-06-23",
        startPrecision: "day",
        status: "current",
        sourceIds: [],
      },
      {
        residencyId: "r2",
        pandaId: "p-xiaoxiao-cq",
        placeId: "pl-cq",
        residencyType: "primary",
        startOn: "2019-06-23",
        startPrecision: "day",
        status: "current",
        sourceIds: [],
      },
    ],
  };
}

describe("createNewsEntityResolver", () => {
  it("disambiguates homonymous pandas using institution residency constraint", () => {
    const resolver = createNewsEntityResolver(catalogFixture());

    const ueno = resolver.resolveItem({
      sourceTier: "media",
      sourceUrl: "https://example.org/ueno/1",
      institutionName: "上野动物园",
      pandaNames: ["晓晓"],
    });
    expect(ueno.institution?.slug).toBe("ueno-zoo");
    expect(ueno.pandas.map((p) => p.canonicalSlug)).toEqual(["xiao-xiao-ueno-2021"]);
    expect(ueno.ambiguousPandaNames).toEqual([]);

    const chongqing = resolver.resolveItem({
      sourceTier: "institution",
      sourceUrl: "https://weibo.com/cq/1",
      authorInstitutionSlug: "chongqing-zoo",
      pandaNames: ["晓晓"],
    });
    expect(chongqing.institution?.slug).toBe("chongqing-zoo");
    expect(chongqing.pandas.map((p) => p.canonicalSlug)).toEqual(["xiao-xiao-chongqing-2019"]);

    const unknownLoc = resolver.resolveItem({
      sourceTier: "fan",
      sourceUrl: "https://weibo.com/fan/1",
      pandaNames: ["晓晓"],
    });
    expect(unknownLoc.pandas).toEqual([]);
    expect(unknownLoc.ambiguousPandaNames).toEqual(["晓晓"]);
  });

  it("prevents romanized fallback collisions across unrelated institutions and resolves domain + nickname", () => {
    const resolver = createNewsEntityResolver(catalogFixture());

    // Without strong Chinese match, Everland cub name must not falsely bind to CCRCGP domestic panda.
    const overseasCub = resolver.resolveItem({
      sourceTier: "media",
      sourceUrl: "https://example.org/everland/cub",
      institutionName: "爱宝乐园",
      pandaNames: ["shu bao qinqin twin"],
    });
    expect(overseasCub.institution?.slug).toBe("everland");
    expect(overseasCub.pandas).toEqual([]);
    expect(overseasCub.unresolvedPandaNames).toEqual(["shu bao qinqin twin"]);

    // Official website domain resolves institution automatically; nickname resolves 和花.
    const officialNotice = resolver.resolveItem({
      sourceTier: "institution",
      sourceUrl: "https://www.panda.org.cn/cn/news/123",
      pandaNames: ["花花"],
    });
    expect(officialNotice.institution?.slug).toBe("chengdu-research-base");
    expect(officialNotice.pandas.map((p) => p.canonicalSlug)).toEqual(["he-hua-chengdu"]);
  });
});
