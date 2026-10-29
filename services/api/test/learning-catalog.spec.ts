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
