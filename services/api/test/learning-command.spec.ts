import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderLearningReport, storedDocument } from "../src/learning-command.js";

const repositoryFile = JSON.parse(
  readFileSync(new URL("../../../data/curation/learning/learning.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("curation.learning batch adapter", () => {
  it("stores the repository file without its comment, as the API reads it", () => {
    const { version, document, catalog } = storedDocument(repositoryFile);
    expect(version).toBe(repositoryFile.version);
    expect(Object.keys(document)).toEqual(["version", "articles", "terms", "faceGuides", "challenges", "monthThemes"]);
    expect(catalog.articles.length).toBeGreaterThan(0);
  });

  it("refuses a document the API could not serve", () => {
    expect(() => storedDocument({ ...repositoryFile, version: 3 })).toThrow();
    expect(() => storedDocument([])).toThrow();
  });

  it("accepts a published Chinese-only term the public catalog can return", () => {
    const zh = { zh: "只有中文" };
    const { catalog } = storedDocument({
      version: "2026.11.04.1",
      articles: [],
      terms: [
        {
          slug: "zh-only",
          status: "published",
          term: zh,
          definition: zh,
          relatedSlugs: [],
          sources: [{ title: { zh: "基地官网" }, url: "https://www.panda.org.cn/", citedOn: "2026-10-29" }],
        },
      ],
      faceGuides: [],
      challenges: [],
    });
    expect(catalog.terms).toEqual([
      {
        slug: "zh-only",
        term: { zh: "只有中文", en: "" },
        definition: { zh: "只有中文", en: "" },
        relatedSlugs: [],
        sources: [{ title: { zh: "基地官网", en: "" }, url: "https://www.panda.org.cn/", citedOn: "2026-10-29" }],
      },
    ]);
  });

  it("summarizes the published entries per collection", () => {
    const markdown = renderLearningReport({
      version: "2026.11.03.1",
      previousVersion: "2026.11.01.2",
      outcome: "written",
      published: { articles: 4, terms: 12, faceGuides: 3, challenges: 1, monthThemes: 0 },
    });
    expect(markdown).toContain("## 科普 catalog 2026.11.03.1: written");
    expect(markdown).toContain("Replaced: 2026.11.01.2.");
    expect(markdown).toContain("| terms | 12 |");
  });
});
