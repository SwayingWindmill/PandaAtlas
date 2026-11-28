import { describe, expect, it } from "vitest";

import type { LookAlikeLink } from "@/features/compare/look-alikes";
import type { CatalogFaceGuide } from "@/features/learning/catalog";
import type { MapItem } from "@/features/map/model";
import type { PandaListItem } from "@/features/pandas/pandas";

import {
  ageBracketOf,
  buildIdentifyProfiles,
  buildIdentifyTraitGroups,
  buildIdentifyVenues,
  buildLivingPool,
  extractFaceGuideTraits,
  filterIdentifyPool,
  formatCandidateMeta,
  orderVenueOptions,
  rankIdentifyCandidates,
  resolveInitialVenueSlug,
  toggleCompareSlug,
  toggleIdentifyTrait,
} from "./identify";

const REF_DATE = new Date("2026-11-28T12:00:00Z");

function makePanda(overrides: Partial<PandaListItem> & Pick<PandaListItem, "id" | "slug" | "name">): PandaListItem {
  return {
    sex: null,
    birthDate: null,
    deceased: false,
    place: null,
    placeId: null,
    area: null,
    hasFullBleedCover: false,
    terms: [overrides.name],
    initials: [],
    ...overrides,
  };
}

function makeVenue(slug: string, name: string, residents: PandaListItem[]): MapItem {
  return {
    id: `inst:${slug}`,
    kind: "institution",
    slug,
    name,
    where: null,
    overseas: false,
    residentCount: residents.length,
    residentNames: residents.map((item) => item.name).join("、"),
    residents: residents.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      hasFullBleedCover: item.hasFullBleedCover,
    })),
    point: null,
    placeIds: [`place:${slug}`],
    coordinates: null,
  };
}

describe("identify Multi-access Key engine", () => {
  it("maps birth dates accurately into age cohorts and ignores missing, rollover, or invalid inputs", () => {
    expect(ageBracketOf("2024-08-15", REF_DATE)).toBe("age:cub");
    expect(ageBracketOf("2021-08-01", REF_DATE)).toBe("age:subadult");
    expect(ageBracketOf("2020-07-20", REF_DATE)).toBe("age:adult");
    expect(ageBracketOf("2010-11-28", REF_DATE)).toBe("age:senior");
    expect(ageBracketOf("2022", REF_DATE)).toBe("age:subadult");
    expect(ageBracketOf("2020-02-31", REF_DATE)).toBeNull();
    expect(ageBracketOf("2028-01-01", REF_DATE)).toBeNull();
    expect(ageBracketOf("unknown", REF_DATE)).toBeNull();
    expect(ageBracketOf(null, REF_DATE)).toBeNull();
  });

  it("extracts visual traits without false positives from negation or contrast notes", () => {
    const baoLiGuide: CatalogFaceGuide = {
      slug: "bao-li",
      pandaSlug: "bao-li",
      title: { zh: "宝力" },
      tips: [
        { key: "shape", label: { zh: "脸型" }, body: { zh: "体形比青宝大，两颊不如青宝蓬松。" } },
        { key: "leftRight", label: { zh: "左右差别" }, body: { zh: "" } },
        { key: "eyePatches", label: { zh: "黑眼圈" }, body: { zh: "眼斑较宽，尖端比青宝的更向外翘。" } },
        { key: "ears", label: { zh: "耳朵" }, body: { zh: "" } },
      ],
      sources: [],
    };
    const lunLunGuide: CatalogFaceGuide = {
      slug: "lun-lun",
      pandaSlug: "lun-lun",
      title: { zh: "伦伦" },
      tips: [
        { key: "shape", label: { zh: "脸型" }, body: { zh: "两颊圆润蓬松。" } },
        { key: "leftRight", label: { zh: "左右差别" }, body: { zh: "左右差别不明显，脸部几乎对称。" } },
        { key: "eyePatches", label: { zh: "黑眼圈" }, body: { zh: "尖端自然下垂，眼圈不算宽。" } },
        {
          key: "ears",
          label: { zh: "耳朵" },
          body: { zh: "在远处分不清伦伦和洋洋时，先看耳朵：游客常靠洋洋的“雷达耳”把他和伦伦区分开。" },
        },
      ],
      sources: [],
    };
    const negatedShapeGuide: CatalogFaceGuide = {
      slug: "slim",
      pandaSlug: "slim",
      title: { zh: "瘦长脸示例" },
      tips: [
        { key: "shape", label: { zh: "脸型" }, body: { zh: "体型不大，脸型没有同伴圆润。" } },
        { key: "leftRight", label: { zh: "左右差别" }, body: { zh: "右耳背有一小块白毛，左耳纯黑。" } },
      ],
      sources: [],
    };

    const baoLi = extractFaceGuideTraits(baoLiGuide);
    expect(baoLi.traits).toEqual(["face:larger_frame", "face:flared_eyes"]);
    expect(baoLi.traits).not.toContain("face:fluffy_cheeks");
    expect(baoLi.faceSummary).toBe("脸型：体形比青宝大，两颊不如青宝蓬松。");

    const lunLun = extractFaceGuideTraits(lunLunGuide);
    expect(lunLun.traits).toEqual(["face:fluffy_cheeks"]);
    expect(lunLun.traits).not.toContain("face:wide_ears");
    expect(lunLun.traits).not.toContain("face:flared_eyes");
    expect(lunLun.traits).not.toContain("face:asymmetric_marks");
    expect(lunLun.faceSummary).toBe("脸型：两颊圆润蓬松。");

    const slim = extractFaceGuideTraits(negatedShapeGuide);
    expect(slim.traits).toEqual(["face:asymmetric_marks"]);
    expect(slim.traits).not.toContain("face:larger_frame");
    expect(slim.traits).not.toContain("face:fluffy_cheeks");
  });

  it("prefers living pandas, keeps deceased twin recognition, and builds ordered venue filters", () => {
    const heHua = makePanda({ id: "p-hh", slug: "he-hua", name: "和花", sex: "female", birthDate: "2020-07-04", hasFullBleedCover: true });
    const heYe = makePanda({ id: "p-hy", slug: "he-ye", name: "和叶", sex: "female", birthDate: "2020-07-04" });
    const mengLan = makePanda({ id: "p-ml", slug: "meng-lan", name: "萌兰", sex: "male", birthDate: "2015-07-04", hasFullBleedCover: true });
    const twinAlive = makePanda({ id: "p-ta", slug: "twin-alive", name: "同胎在世", birthDate: "2018-06-01" });
    const twinDeceased = makePanda({ id: "p-td", slug: "twin-deceased", name: "同胎已故", birthDate: "2018-06-01", deceased: true });
    const historic = makePanda({ id: "p-old", slug: "pan-pan", name: "盼盼", sex: "male", birthDate: "1985-01-01", deceased: true });

    const allPandas = [heHua, heYe, mengLan, twinAlive, twinDeceased, historic];
    const living = buildLivingPool(allPandas);
    expect(living.map((p) => p.slug)).toEqual(["he-hua", "he-ye", "meng-lan", "twin-alive"]);

    const venues = buildIdentifyVenues(living, [
      makeVenue("beijing-zoo", "北京动物园", [mengLan]),
      makeVenue("chengdu-research-base", "成都基地", [heHua, heYe]),
      makeVenue("empty-zoo", "已迁移展馆", [historic]),
    ]);
    expect(venues.map((v) => `${v.slug}:${v.residentCount}`)).toEqual(["chengdu-research-base:2", "beijing-zoo:1"]);
    expect(resolveInitialVenueSlug(venues, "beijing-zoo")).toBe("beijing-zoo");
    expect(resolveInitialVenueSlug(venues, "missing-zoo")).toBeNull();
    expect(orderVenueOptions(venues, "beijing-zoo").map((v) => v.slug)).toEqual(["beijing-zoo", "chengdu-research-base"]);
    expect(filterIdentifyPool(living, venues, "chengdu-research-base").map((p) => p.slug)).toEqual(["he-hua", "he-ye"]);
    expect(filterIdentifyPool(living, venues, "empty-zoo")).toEqual([]);

    const profiles = buildIdentifyProfiles(
      allPandas,
      [
        { childId: "p-ta", parentId: "p-hh", parentRole: "mother", sourceIds: ["s1"] },
        { childId: "p-td", parentId: "p-hh", parentRole: "mother", sourceIds: ["s1"] },
      ],
      [],
      REF_DATE,
    );
    expect(profiles.get("p-ta")?.traits.has("companion:twin")).toBe(true);
  });

  it("ranks candidates with soft matching, sourced lineage roles, and neutral missing fields", () => {
    const heHua = makePanda({
      id: "p-hh",
      slug: "he-hua",
      name: "和花",
      sex: "female",
      birthDate: "2020-07-04",
      place: "成都基地",
      hasFullBleedCover: true,
    });
    const heYe = makePanda({
      id: "p-hy",
      slug: "he-ye",
      name: "和叶",
      sex: "female",
      birthDate: "2020-07-04",
      place: "成都基地",
    });
    const mother = makePanda({
      id: "p-cg",
      slug: "cheng-gong",
      name: "成功",
      sex: "female",
      birthDate: "2000-09-11",
      place: "成都基地",
    });
    const unknown = makePanda({
      id: "p-unk",
      slug: "unknown-cub",
      name: "待补充档案",
    });
    const maleSenior = makePanda({
      id: "p-sr",
      slug: "senior-male",
      name: "高龄雄性",
      sex: "male",
      birthDate: "2008-08-01",
    });

    const lineage: LookAlikeLink[] = [
      { childId: "p-hh", parentId: "p-cg", parentRole: "mother", sourceIds: ["src-1"] },
      { childId: "p-hy", parentId: "p-cg", parentRole: "mother", sourceIds: ["src-1"] },
      // Unsourced link must be ignored
      { childId: "p-unk", parentId: "p-sr", parentRole: "father", sourceIds: [] },
    ];
    const guides: CatalogFaceGuide[] = [
      {
        slug: "he-hua",
        pandaSlug: "he-hua",
        title: { zh: "和花" },
        tips: [{ key: "shape", label: { zh: "脸型" }, body: { zh: "圆润三角脸，两颊蓬松。" } }],
        sources: [],
      },
    ];

    const pool = [maleSenior, unknown, heYe, mother, heHua];
    const profiles = buildIdentifyProfiles(pool, lineage, guides, REF_DATE);
    const groups = buildIdentifyTraitGroups(pool, profiles);
    const traitIds = groups.flatMap((group) => group.options.map((option) => option.id));

    expect(traitIds).toContain("companion:twin");
    expect(traitIds).toContain("companion:parent");
    expect(traitIds).toContain("face:fluffy_cheeks");
    expect(traitIds).toContain("media:has_cover");

    const ranked = rankIdentifyCandidates(pool, profiles, ["sex:female", "age:adult", "companion:twin", "face:fluffy_cheeks"]);
    expect(ranked.candidates.map((item) => item.panda.slug)).toEqual([
      "he-hua", // matches all 4
      "he-ye", // matches sex + age + twin
      "cheng-gong", // matches sex, mismatches age (-1) -> score 1
      "unknown-cub", // missing sex/age -> neutral 0
      "senior-male", // contradicts both sex (-1) and age (-1) -> score -2
    ]);
    expect(ranked.top3.map((item) => item.panda.slug)).toEqual(["he-hua", "he-ye", "cheng-gong"]);
    expect(ranked.top3[0]?.matchedTraits).toHaveLength(4);
    expect(formatCandidateMeta(heHua)).toBe("成都基地　2020 年出生　雌");
  });

  it("handles trait mutual exclusivity and caps comparison selection at two pandas", () => {
    let traits = toggleIdentifyTrait([], "sex:female");
    traits = toggleIdentifyTrait(traits, "age:adult");
    expect(traits).toEqual(["sex:female", "age:adult"]);
    traits = toggleIdentifyTrait(traits, "sex:male");
    expect(traits).toEqual(["age:adult", "sex:male"]);
    traits = toggleIdentifyTrait(traits, "sex:male");
    expect(traits).toEqual(["age:adult"]);

    let compare = toggleCompareSlug([], "he-hua");
    compare = toggleCompareSlug(compare, "he-ye");
    expect(compare).toEqual(["he-hua", "he-ye"]);
    compare = toggleCompareSlug(compare, "meng-lan");
    expect(compare).toEqual(["he-ye", "meng-lan"]);
    compare = toggleCompareSlug(compare, "he-ye");
    expect(compare).toEqual(["meng-lan"]);
  });
});
