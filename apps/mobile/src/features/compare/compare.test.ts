import { describe, expect, it } from "vitest";

import type { CatalogChallenge, CatalogFaceGuide, LearningCatalog } from "../learning/catalog";
import type { PandaListItem } from "../pandas/pandas";
import type { ParentLink } from "../relationship/relationship";

import {
  type CompareCandidate,
  buildArchiveComparison,
  buildFeaturedComparePairs,
  comparePandas,
  compareSuggestions,
  formatBirthDelta,
  missingLine,
  summarizeCompareKinship,
} from "./compare";

// Fixtures use placeholder words only: the page must repeat what the catalog says, never write its own.
const source = (url: string) => ({ title: { zh: `出处 ${url}` }, url, citedOn: "2026-10-30" });
const guide = (pandaSlug: string, tips: Partial<Record<"shape" | "leftRight" | "eyePatches" | "ears", string>>): CatalogFaceGuide => ({
  slug: `${pandaSlug}-face`,
  pandaSlug,
  title: { zh: "认脸" },
  tips: (Object.entries(tips) as [CatalogFaceGuide["tips"][number]["key"], string][]).map(([key, body]) => ({
    key,
    label: { zh: `标签-${key}` },
    body: { zh: body },
  })),
  sources: [source(`https://example.org/${pandaSlug}`)],
});
const challenge = (answer: string, decoys: string[], tip = "提示文字"): CatalogChallenge => ({
  slug: `${answer}-round`,
  answerPandaSlug: answer,
  decoyPandaSlugs: decoys,
  prompt: { zh: "选一只" },
  tip: { zh: tip },
  sources: [source(`https://example.org/${answer}-round`)],
});
const catalog = (faceGuides: CatalogFaceGuide[], challenges: CatalogChallenge[] = []): LearningCatalog => ({
  version: "test",
  articles: [],
  terms: [],
  faceGuides,
  challenges,
});
const A = { id: "1", slug: "a", name: "甲" };
const B = { id: "2", slug: "b", name: "乙" };

describe("comparePandas", () => {
  it("is pending with both pandas listed as missing when nothing is written", () => {
    const result = comparePandas(catalog([]), A, B);
    expect(result.state).toBe("pending");
    expect(result.points).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(result.missing.map((item) => [item.pandaSlug, item.noGuide, item.slots])).toEqual([
      ["a", true, ["脸型", "左右差别", "黑眼圈", "耳朵"]],
      ["b", true, ["脸型", "左右差别", "黑眼圈", "耳朵"]],
    ]);
  });

  it("repeats only written slots, leaving the other side null, and cites only contributing sources", () => {
    const result = comparePandas(catalog([guide("a", { shape: "甲的脸型", eyePatches: "" }), guide("b", {})]), A, B);
    expect(result.state).toBe("ready");
    expect(result.points).toEqual([{ key: "shape", label: "标签-shape", a: "甲的脸型", b: null }]);
    expect(result.sources.map((item) => item.url)).toEqual(["https://example.org/a"]);
    expect(result.missing.find((item) => item.pandaSlug === "a")?.slots).toEqual(["左右差别", "标签-eyePatches", "耳朵"]);
    expect(result.missing.find((item) => item.pandaSlug === "b")?.noGuide).toBe(false);
  });

  it("adds a challenge hint only when one is the answer and the other a choice", () => {
    const linked = comparePandas(catalog([], [challenge("a", ["b", "c"])]), A, B);
    expect(linked.state).toBe("ready");
    expect(linked.hints).toEqual([{ slug: "a-round", answerSlug: "a", text: "提示文字" }]);
    expect(linked.sources.map((item) => item.url)).toEqual(["https://example.org/a-round"]);
    expect(comparePandas(catalog([], [challenge("c", ["a", "b"])]), A, B).hints).toEqual([]);
    expect(comparePandas(catalog([], [challenge("a", ["b"], "")]), A, B).state).toBe("pending");
  });
});

describe("missingLine", () => {
  it("says what the writers still need", () => {
    expect(missingLine({ pandaSlug: "a", pandaName: "甲", slots: ["脸型", "耳朵"], noGuide: true })).toBe("甲：还没有认脸指南（脸型、耳朵都待补）");
    expect(missingLine({ pandaSlug: "a", pandaName: "甲", slots: ["耳朵"], noGuide: false })).toBe("甲：耳朵还空着");
  });
});

describe("compareSuggestions", () => {
  const panda = (slug: string, extra: Partial<CompareCandidate> = {}): CompareCandidate => ({
    id: slug,
    slug,
    name: slug.toUpperCase(),
    placeId: "p1",
    place: "某基地",
    birthDate: "2015-08-01",
    deceased: false,
    ...extra,
  });
  const target = panda("t");

  it("puts challenge partners first, then living housemates nearest in age, at most three", () => {
    const pandas = [
      target,
      panda("far", { birthDate: "2001-01-01" }),
      panda("near", { birthDate: "2016-01-01" }),
      panda("gone", { deceased: true, birthDate: "2015-01-01" }),
      panda("elsewhere", { placeId: "p2", birthDate: "2015-01-01" }),
      panda("decoy", { placeId: "p9" }),
      panda("mid", { birthDate: "2012-01-01" }),
    ];
    const result = compareSuggestions(target, pandas, [challenge("t", ["decoy", "missing"])]);
    expect(result.map((item) => [item.panda.slug, item.reason])).toEqual([
      ["decoy", "在认脸挑战里一起出现"],
      ["near", "同住某基地"],
      ["mid", "同住某基地"],
    ]);
  });

  it("offers nothing when the panda has no place and no challenge", () => {
    expect(compareSuggestions(panda("t", { placeId: null, place: null }), [panda("x")], [])).toEqual([]);
  });

  it("never offers the panda itself", () => {
    expect(compareSuggestions(target, [target], [challenge("x", ["t"])])).toEqual([]);
  });
});

const listPanda = (slug: string, extra: Partial<PandaListItem> = {}): PandaListItem => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  sex: null,
  birthDate: null,
  deceased: false,
  place: null,
  placeId: null,
  area: null,
  hasFullBleedCover: true,
  studbookNumber: null,
  terms: [slug],
  initials: [],
  ...extra,
});

describe("formatBirthDelta", () => {
  it("handles identical dates, day deltas, month boundaries, leap years, and partial dates", () => {
    expect(formatBirthDelta("2020-07-04", "2020-07-04")).toBe("同日出生");
    expect(formatBirthDelta("2020-07-04", "2020-07-20")).toBe("差 16 天");
    expect(formatBirthDelta("2020-12-31", "2021-01-01")).toBe("差 1 天");
    expect(formatBirthDelta("2020-07-15", "2020-08-03")).toBe("差 19 天");
    expect(formatBirthDelta("2020-01-31", "2020-02-29")).toBe("差 29 天");
    expect(formatBirthDelta("2020-07-04", "2020-08-04")).toBe("差 1 个月");
    expect(formatBirthDelta("2020-07-04", "2021-07-03")).toBe("差 11 个月");
    expect(formatBirthDelta("2020-02-29", "2021-02-28")).toBe("差 11 个月");
    expect(formatBirthDelta("2020-02-29", "2021-03-01")).toBe("差 1 岁");
    expect(formatBirthDelta("2020-07-04", "2021-08-21")).toBe("差 1 岁");
    expect(formatBirthDelta("2020-07", "2020-09")).toBe("差 2 个月");
    expect(formatBirthDelta("2020-07", "2020-07")).toBeNull();
    expect(formatBirthDelta("2018", "2020-07-04")).toBe("差 2 岁");
    expect(formatBirthDelta("2020", "2020-07-04")).toBeNull();
    expect(formatBirthDelta(null, "2020-07-04")).toBeNull();
  });
});

describe("buildArchiveComparison", () => {
  it("builds all four core rows with sex, formatted birth date + delta, place/deceased, and studbook", () => {
    const heHua = listPanda("he-hua", {
      name: "和花",
      sex: "female",
      birthDate: "2020-07-04",
      place: "成都基地",
      placeId: "place-cd",
      studbookNumber: "#1237",
    });
    const fuBao = listPanda("fu-bao", {
      name: "福宝",
      sex: "female",
      birthDate: "2020-07-20",
      place: "卧龙基地",
      placeId: "place-wl",
      studbookNumber: "#1243",
    });

    expect(buildArchiveComparison(heHua, fuBao)).toEqual([
      { key: "sex", label: "性别", aValue: "雌性", bValue: "雌性", badge: null },
      { key: "birth", label: "出生", aValue: "2020.07.04", bValue: "2020.07.20", badge: "差 16 天" },
      { key: "place", label: "现居", aValue: "成都基地", bValue: "卧龙基地", badge: null },
      { key: "studbook", label: "谱系号", aValue: "#1237", bValue: "#1243", badge: null },
    ]);
  });

  it("marks living co-residents with 同住一馆, hides badge when one is deceased, and formats year-only / missing fields", () => {
    const a = listPanda("a", {
      sex: "male",
      birthDate: "2019",
      place: "成都基地",
      placeId: "place-cd",
      studbookNumber: null,
    });
    const b = listPanda("b", {
      sex: null,
      birthDate: null,
      place: "成都基地",
      placeId: "place-cd",
      studbookNumber: "#999",
    });
    expect(buildArchiveComparison(a, b)).toEqual([
      { key: "sex", label: "性别", aValue: "雄性", bValue: "未记录", badge: null },
      { key: "birth", label: "出生", aValue: "2019 年", bValue: "未记录", badge: null },
      { key: "place", label: "现居", aValue: "成都基地", bValue: "成都基地", badge: "同住一馆" },
      { key: "studbook", label: "谱系号", aValue: "—", bValue: "#999", badge: null },
    ]);

    const gone = listPanda("gone", { deceased: true, place: "成都基地", placeId: "place-cd" });
    const placeRow = buildArchiveComparison(a, gone).find((row) => row.key === "place");
    expect(placeRow).toEqual({
      key: "place",
      label: "现居",
      aValue: "成都基地",
      bValue: "已离世",
      badge: null,
    });
  });
});

describe("summarizeCompareKinship", () => {
  const mom = listPanda("mom", { name: "成功", sex: "female", birthDate: "2000-09-11" });
  const dadA = listPanda("dad-a", { name: "美兰", sex: "male", birthDate: "2006-09-06" });
  const dadB = listPanda("dad-b", { name: "芦芦", sex: "male", birthDate: "1999-08-01" });
  const a = listPanda("a", { name: "和花", sex: "female", birthDate: "2020-07-04" });
  const b = listPanda("b", { name: "和叶", sex: "male", birthDate: "2020-07-04" });
  const c = listPanda("c", { name: "宝力", sex: "male", birthDate: "2021-08-21" });
  const halfSib = listPanda("half", { name: "和风", sex: "male", birthDate: "2016-08-09" });
  const sharedMomA = listPanda("shared-mom-a", { name: "星二", sex: "female", birthDate: "2010-08-01" });
  const sharedCub = listPanda("shared-cub", { name: "小仔", sex: "female", birthDate: "2022-07-01" });
  const pandas = [mom, dadA, dadB, a, b, c, halfSib, sharedMomA, sharedCub];
  const links: ParentLink[] = [
    { childId: a.id, parentId: mom.id, parentRole: "mother" },
    { childId: a.id, parentId: dadA.id, parentRole: "father" },
    { childId: b.id, parentId: mom.id, parentRole: "mother" },
    { childId: b.id, parentId: dadA.id, parentRole: "father" },
    { childId: halfSib.id, parentId: mom.id, parentRole: "mother" },
    { childId: halfSib.id, parentId: dadB.id, parentRole: "father" },
    { childId: sharedCub.id, parentId: dadA.id, parentRole: "father" },
    { childId: sharedCub.id, parentId: sharedMomA.id, parentRole: "mother" },
  ];

  it("summarizes named kinship terms and relationship deep link", () => {
    const result = summarizeCompareKinship(a, b, links, pandas);
    expect(result).toEqual({
      linked: true,
      title: "和叶是和花的双胞胎兄弟",
      subtitle: "查看完整亲缘链路",
      stepsCount: 2,
      term: "双胞胎兄弟",
      href: { pathname: "/relationship", params: { a: "a", b: "b" } },
    });
  });

  it("falls back to general link phrasing when two pandas share a cub without a kin term", () => {
    const result = summarizeCompareKinship(dadA, sharedMomA, links, pandas);
    expect(result.linked).toBe(true);
    expect(result.term).toBeNull();
    expect(result.title).toBe("美兰和星二有亲缘联系");
    expect(result.subtitle).toBe("查看完整亲缘链路");
    expect(result.href).toEqual({ pathname: "/relationship", params: { a: "dad-a", b: "shared-mom-a" } });
  });

  it("calmly summarizes unlinked pairs with relationship lookup href", () => {
    const result = summarizeCompareKinship(a, c, links, pandas);
    expect(result).toEqual({
      linked: false,
      title: "和花与宝力暂未发现直系亲缘",
      subtitle: "打开亲缘查询",
      stepsCount: 0,
      term: null,
      href: { pathname: "/relationship", params: { a: "a", b: "c" } },
    });
  });
});

describe("buildFeaturedComparePairs", () => {
  it("merges curated comparisons and derived pairs without duplicates", () => {
    const heHua = listPanda("he-hua", { name: "和花", birthDate: "2020-07-04", place: "成都基地" });
    const heYe = listPanda("he-ye", { name: "和叶", birthDate: "2020-07-04", place: "成都基地" });
    const baoLi = listPanda("bao-li", { name: "宝力", birthDate: "2021-08-21", place: "华盛顿" });
    const qingBao = listPanda("qing-bao", { name: "青宝", birthDate: "2021-09-12", place: "华盛顿" });
    const pandas = [heHua, heYe, baoLi, qingBao];

    const curated = [
      {
        id: "c1",
        title: "和花和和叶，成都双胞胎",
        dek: "同日生于成都基地",
        pandaSlugs: ["he-hua", "he-ye"],
        updatedAt: "2026-11-22",
      },
    ];
    const links = [
      { childId: heHua.id, parentId: "mom", parentRole: "mother" as const, sourceIds: ["s1"] },
      { childId: heYe.id, parentId: "mom", parentRole: "mother" as const, sourceIds: ["s1"] },
    ];
    const challenges = [{ answerPandaSlug: "bao-li", decoyPandaSlugs: ["qing-bao"] }];

    const featured = buildFeaturedComparePairs(pandas, curated, links, challenges);
    expect(featured.map((item) => [item.key, item.tag, item.subtitle])).toEqual([
      ["he-hua+he-ye", "成都双胞胎", "同日生于成都基地"],
      ["bao-li+qing-bao", "认脸挑战对照", "同住华盛顿　外貌与档案对照"],
    ]);
  });
});
