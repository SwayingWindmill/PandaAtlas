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
    expect(Object.keys(document)).toEqual(["version", "articles", "cards", "topics", "terms", "faceGuides", "challenges"]);
    expect(catalog.articles.length).toBeGreaterThan(0);
  });

  it("refuses a document the API could not serve", () => {
    expect(() => storedDocument({ ...repositoryFile, version: 3 })).toThrow();
    expect(() => storedDocument([])).toThrow();
  });

  it("summarizes the published entries per collection", () => {
    const markdown = renderLearningReport({
      version: "2026.11.03.1",
      previousVersion: "2026.11.01.2",
      outcome: "written",
      published: { articles: 4, cards: 0, topics: 0, terms: 12, faceGuides: 3, challenges: 1 },
    });
    expect(markdown).toContain("## 科普 catalog 2026.11.03.1: written");
    expect(markdown).toContain("Replaced: 2026.11.01.2.");
    expect(markdown).toContain("| terms | 12 |");
  });
});
