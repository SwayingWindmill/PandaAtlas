import { describe, expect, it } from "vitest";

import type { CatalogChallenge, CatalogFaceGuide, LearningCatalog } from "../learning/catalog";

import { type CompareCandidate, comparePandas, compareSuggestions, missingLine } from "./compare";

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
  cards: [],
  topics: [],
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
