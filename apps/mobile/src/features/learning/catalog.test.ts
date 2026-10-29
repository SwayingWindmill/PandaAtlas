import { describe, expect, it } from "vitest";

import {
  CatalogUnavailable,
  type LearningDocument,
  assembleCatalog,
  catalogIsEmpty,
  learningText,
  presentChallenge,
  resolveChallenge,
  visibleTips,
} from "./catalog";

const text = { zh: "[草稿] 黑眼圈", en: "[draft] Eye patches" };
const source = { title: text, url: null, citedOn: null };

const bundled: LearningDocument = {
  version: "2026.10.29.1",
  cards: [
    { slug: "draft-card", status: "draft", title: text, summary: text, body: text, sources: [source] },
    {
      slug: "live-card",
      status: "published",
      title: { zh: "已发布", en: "Published" },
      summary: text,
      body: text,
      sources: [{ title: text, url: "https://www.panda.org.cn/", citedOn: "2026-10-29" }],
    },
  ],
  topics: [],
  terms: [],
  faceGuides: [],
  challenges: [
    {
      slug: "bao-li-round",
      status: "draft",
      answerPandaSlug: "bao-li",
      decoyPandaSlugs: ["lun-lun", "lei-lei", "yang-yang"],
      prompt: { zh: "[草稿] 看照片，选出这只熊猫", en: "[draft] Which panda is this?" },
      tip: { zh: "[草稿] 占位提示。", en: "[draft] Placeholder tip." },
      sources: [source],
    },
  ],
};

const pandas = [
  { id: "1", slug: "bao-li", name: "宝力" },
  { id: "2", slug: "lei-lei", name: "蕾蕾" },
  { id: "3", slug: "lun-lun", name: "伦伦" },
  { id: "4", slug: "yang-yang", name: "洋洋" },
];

describe("assembleCatalog", () => {
  it("shows only the published API catalog in a production build", () => {
    const remote = assembleCatalog(null, bundled, true);
    const production = assembleCatalog(
      { version: "2026.10.29.1", cards: remote.cards.filter((card) => card.slug === "live-card"), topics: [], terms: [], faceGuides: [], challenges: [] },
      bundled,
      false,
    );
    expect(production.cards.map((card) => card.slug)).toEqual(["live-card"]);
    expect(production.challenges).toEqual([]);
  });

  it("shows drafts from the working file, and a published API entry replaces the same slug", () => {
    const catalog = assembleCatalog(
      {
        version: "2026.11.01.1",
        cards: [{ slug: "live-card", title: { zh: "新正文", en: "New" }, summary: text, body: text, sources: [source] }],
        topics: [],
        terms: [],
        faceGuides: [],
        challenges: [],
      },
      bundled,
      true,
    );
    expect(catalog.version).toBe("2026.11.01.1");
    expect(catalog.cards.map((card) => card.title.zh)).toEqual(["[草稿] 黑眼圈", "新正文"]);
    expect(catalog.challenges).toHaveLength(1);
    expect(catalogIsEmpty(catalog)).toBe(false);
  });

  it("fails when a production build cannot read the catalog", () => {
    expect(() => assembleCatalog(null, bundled, false)).toThrow(CatalogUnavailable);
  });
});

describe("resolveChallenge", () => {
  const challenge = assembleCatalog(null, bundled, true).challenges[0];

  it("names four real pandas and keeps the answer's photo", () => {
    if (challenge === undefined) throw new Error("fixture");
    const resolved = resolveChallenge(challenge, pandas);
    expect(resolved?.answerSlug).toBe("bao-li");
    expect(resolved?.photoPandaId).toBe("1");
    expect(resolved?.options.map((option) => option.slug)).toEqual(["bao-li", "lei-lei", "lun-lun", "yang-yang"]);
    expect(learningText(challenge.tip)).toBe("[草稿] 占位提示。");
  });

  it("hides a face-guide tip whose body is empty", () => {
    const tips = [
      { body: { zh: "两颊圆润。", en: "Round cheeks." } },
      { body: { zh: "", en: "" } },
      { body: { zh: "  ", en: "" } },
    ];
    expect(visibleTips(tips)).toEqual([{ body: { zh: "两颊圆润。", en: "Round cheeks." } }]);
  });

  it("does not invent a name when a panda is missing from the release", () => {
    if (challenge === undefined) throw new Error("fixture");
    expect(resolveChallenge(challenge, pandas.slice(0, 2))).toBeNull();
  });
});

describe("presentChallenge", () => {
  const round = assembleCatalog(null, bundled, true).challenges[0];

  function resolved() {
    if (round === undefined) throw new Error("fixture");
    const value = resolveChallenge(round, pandas);
    if (value === null) throw new Error("fixture");
    return value;
  }

  it("asks with a second photo and keeps the cover on the correct choice", () => {
    const photos = new Map<string, string[]>([
      ["1", ["https://photos.example/bao-cover", "https://photos.example/bao-other"]],
      ["2", ["https://photos.example/lei"]],
      ["3", ["https://photos.example/lun"]],
      ["4", ["https://photos.example/yang"]],
    ]);
    const presented = presentChallenge(resolved(), photos);
    expect(presented.mode).toBe("compare");
    expect(presented.questionPhotoUrl).toBe("https://photos.example/bao-other");
    expect(presented.title).toBe("[草稿] 看照片，选出这只熊猫");
    expect(presented.options.find((option) => option.slug === "bao-li")?.photoUrl).toBe("https://photos.example/bao-cover");
  });

  it("asks by name and drops the question photo when the answer has only one picture", () => {
    const photos = new Map<string, string[]>(pandas.map((panda) => [panda.id, [`https://photos.example/${panda.slug}`]]));
    const presented = presentChallenge(resolved(), photos);
    expect(presented).toMatchObject({
      mode: "named",
      title: "哪一只是宝力？",
      questionPhotoUrl: null,
    });
    expect(presented.options.map((option) => option.name)).toEqual(["宝力", "蕾蕾", "伦伦", "洋洋"]);
  });

  it("treats a repeated photo url as a single picture", () => {
    const photos = new Map<string, string[]>([["1", ["https://photos.example/bao", "https://photos.example/bao"]]]);
    expect(presentChallenge(resolved(), photos).mode).toBe("named");
  });
});
