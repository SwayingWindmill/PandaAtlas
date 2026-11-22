import { describe, expect, it } from "vitest";

import { contentKind, renderContentReport, writeContent } from "../src/content-command.js";
import type { Database } from "../src/platform/database/database.types.js";
import type { Kysely } from "kysely";

const noDatabase = {} as Kysely<Database>;

describe("curation.content", () => {
  it("picks what to write from the manifest path and refuses any other file", () => {
    expect(contentKind("data/curation/venue-news/venue-news.json")).toBe("venue-news");
    expect(contentKind("./data/curation/overseas-status/overseas-status.json")).toBe("overseas-status");
    expect(contentKind(String.raw`data\curation\institutions\institutions.json`)).toBe("institutions");
    expect(contentKind(String.raw`data\curation\panda-enrichment\top-pandas.json`)).toBe("panda-enrichment");
    expect(() => contentKind("data/curation/learning/learning.json")).toThrow(/not data/);
  });

  it("refuses a document the API would refuse before touching the database", async () => {
    await expect(writeContent(noDatabase, "venue-news", { version: "v", items: [{ id: "a" }] })).rejects.toThrow();
    await expect(writeContent(noDatabase, "venue-news", { items: [] })).rejects.toThrow(/version/);
    await expect(writeContent(noDatabase, "institutions", { institutions: [{}] })).rejects.toThrow(/slug/);
    await expect(
      writeContent(noDatabase, "institutions", {
        institutions: [
          {
            slug: "bad-zoo",
            nameEn: "Bad Zoo",
            profile: { kind: "aquarium", verifiedOn: "2026-11-22", sourceUrls: ["https://example.com"] },
          },
        ],
      }),
    ).rejects.toThrow(/institution kind/);
    await expect(
      writeContent(noDatabase, "institutions", {
        institutions: [
          {
            slug: "bad-guide-zoo",
            nameEn: "Bad Guide Zoo",
            profile: { kind: "zoo", verifiedOn: "2026-11-22", sourceUrls: ["https://example.com"] },
            places: [
              {
                slug: "bad-guide-zoo",
                visitGuide: { tips: [{ topic: "invalid", text: { en: "x" } }], verifiedOn: "2026-11-22", sourceUrls: ["https://example.com"] },
              },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/unknown topic/);
    await expect(
      writeContent(noDatabase, "panda-enrichment", {
        version: "bad",
        updatedAt: "2026-11-22T18:00:00+08:00",
        sources: [],
        items: [],
      }),
    ).rejects.toThrow(/version/);
  });

  it("tells the owner to publish a release after institutions or panda-enrichment", () => {
    const markdown = renderContentReport({ kind: "institutions", outcome: "written", counts: { institutions: 5, places: 6, merged: 0 } });
    expect(markdown).toContain("| places | 6 |");
    expect(markdown).toContain("release.publish");

    const enrichmentMarkdown = renderContentReport({
      kind: "panda-enrichment",
      version: "2026.11.22.1",
      outcome: "written",
      counts: { items: 65, sources: 42, factsWritten: 120 },
    });
    expect(enrichmentMarkdown).toContain("## panda-enrichment 2026.11.22.1: written");
    expect(enrichmentMarkdown).toContain("| items | 65 |");
    expect(enrichmentMarkdown).toContain("release.publish");
  });
});
