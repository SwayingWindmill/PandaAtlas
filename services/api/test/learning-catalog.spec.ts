import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterEach, describe, expect, it } from "vitest";
import { createApplication } from "../src/bootstrap.js";
import { LearningCatalogError, publishedCatalog } from "../src/modules/learning/application/learning-catalog.js";
import { injectHttp } from "./inject-http.js";

const text = { zh: "黑眼圈", en: "Eye patches" };
const source = { title: { zh: "基地官网", en: "Base website" }, url: "https://www.panda.org.cn/", citedOn: "2026-10-29" };

function entry(status: "draft" | "published", slug: string) {
  return {
    slug,
    status,
    title: text,
    summary: text,
    body: text,
    sources: [source],
  };
}

function document(status: "draft" | "published" = "published") {
  return {
    version: "2026.10.29.1",
    articles: [],
    cards: [entry("draft", "draft-card"), entry(status, "black-eye-patches")],
    topics: [],
    terms: [],
    faceGuides: [],
    challenges: [],
  };
}

describe("publishedCatalog", () => {
  it("returns an empty catalog when no row is stored", () => {
    expect(publishedCatalog(null)).toEqual({
      version: "",
      articles: [],
      cards: [],
      topics: [],
      terms: [],
      faceGuides: [],
      challenges: [],
    });
  });

  it("drops draft entries and the status field", () => {
    const catalog = publishedCatalog({ version: "2026.10.29.1", document: document() });
    expect(catalog.version).toBe("2026.10.29.1");
    expect(catalog.cards).toEqual([
      {
        slug: "black-eye-patches",
        title: text,
        summary: text,
        body: text,
        sources: [source],
      },
    ]);
    expect(catalog.cards[0]).not.toHaveProperty("status");
  });

  it("fails closed when the stored document does not match its version", () => {
    expect(() => publishedCatalog({ version: "2026.10.29.2", document: document() })).toThrow(LearningCatalogError);
  });

  it("returns a published Chinese-only entry with blank English", () => {
    const zh = { zh: "只有中文" };
    const source = { title: { zh: "基地官网" }, url: "https://www.panda.org.cn/", citedOn: "2026-10-29" };
    const blank = { zh: "只有中文", en: "" };
    const blankSource = { title: { zh: "基地官网", en: "" }, url: source.url, citedOn: source.citedOn };
    const catalog = publishedCatalog({
      version: "2026.11.04.1",
      document: {
        version: "2026.11.04.1",
        articles: [
          {
            slug: "zh-article",
            status: "published",
            category: "外形与识别",
            sourceCardSlug: "zh-card",
            title: zh,
            dek: zh,
            pullQuote: zh,
            body: { sections: [{ heading: zh, paragraphs: [{ text: zh, refs: ["ref"] }] }] },
            keyFacts: [{ text: zh, refs: ["ref"] }],
            images: [{ role: "hero", type: "wanted", pandaSlug: null, caption: zh, shot: zh }],
            references: [{ id: "ref", title: "基地官网", publisher: "基地", url: source.url, citedOn: source.citedOn }],
            relatedArticles: [],
            stats: {},
            glossaryTerms: [],
          },
        ],
        cards: [{ slug: "zh-card", status: "published", title: zh, summary: zh, body: zh, sources: [source] }],
        topics: [
          {
            slug: "zh-topic",
            status: "published",
            title: zh,
            summary: zh,
            sections: [{ heading: zh, body: zh }],
            cardSlugs: ["zh-card"],
            sources: [source],
          },
        ],
        terms: [{ slug: "zh-term", status: "published", term: zh, definition: zh, relatedSlugs: [], sources: [source] }],
        faceGuides: [
          {
            slug: "bao-li",
            status: "published",
            pandaSlug: "bao-li",
            title: zh,
            tips: ["shape", "leftRight", "eyePatches", "ears"].map((key) => ({ key, label: zh, body: zh })),
            sources: [source],
          },
        ],
        challenges: [
          {
            slug: "bao-li-round",
            status: "published",
            answerPandaSlug: "bao-li",
            decoyPandaSlugs: ["lun-lun", "lei-lei", "yang-yang-atlanta"],
            prompt: zh,
            tip: zh,
            sources: [source],
          },
        ],
      },
    });
    const article = catalog.articles[0];
    const topic = catalog.topics[0];
    const term = catalog.terms[0];
    const guide = catalog.faceGuides[0];
    const challenge = catalog.challenges[0];
    const paragraph = article?.body.sections[0]?.paragraphs[0];
    const tip = guide?.tips[0];
    if (article === undefined || topic === undefined || term === undefined || guide === undefined || challenge === undefined) {
      throw new Error("fixture");
    }
    if (paragraph === undefined || tip === undefined) throw new Error("fixture");
    expect(catalog.articles.map((item) => item.slug)).toEqual(["zh-article"]);
    expect(article.title).toEqual(blank);
    expect(paragraph.text).toEqual(blank);
    expect(catalog.cards).toEqual([{ slug: "zh-card", title: blank, summary: blank, body: blank, sources: [blankSource] }]);
    expect(topic.title).toEqual(blank);
    expect(topic.sections[0]).toEqual({ heading: blank, body: blank });
    expect(term.term).toEqual(blank);
    expect(term.definition).toEqual(blank);
    expect(guide.title).toEqual(blank);
    expect(tip).toEqual({ key: "shape", label: blank, body: blank });
    expect(challenge.prompt).toEqual(blank);
    expect(challenge.tip).toEqual(blank);
  });

  it("still refuses a text field whose English value is not a string", () => {
    const broken = document();
    const published = broken.cards[1];
    if (published === undefined) throw new Error("fixture");
    published.title = { zh: "黑眼圈", en: 1 as unknown as string };
    expect(() => publishedCatalog({ version: "2026.10.29.1", document: broken })).toThrow(LearningCatalogError);
  });

  it("fails closed when a published entry has no https source", () => {
    const broken = document();
    const published = broken.cards[1];
    if (published === undefined) throw new Error("fixture");
    const citation = published.sources[0];
    if (citation === undefined) throw new Error("fixture");
    citation.url = "http://example.test/x";
    expect(() => publishedCatalog({ version: "2026.10.29.1", document: broken })).toThrow(LearningCatalogError);
  });
});

describe("GET /api/v2/learning", () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    delete process.env.DATABASE_URL;
    if (app !== undefined) await app.close();
  });

  it("does not serve a catalog when the database is not configured", async () => {
    process.env.APP_ENV = "test";
    process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
    delete process.env.DATABASE_URL;
    app = await createApplication();
    const response = await injectHttp(app, { method: "GET", url: "/api/v2/learning" });
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
  });
});
