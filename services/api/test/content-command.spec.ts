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
    expect(() => contentKind("data/curation/learning/learning.json")).toThrow(/not data/);
  });

  it("refuses a document the API would refuse before touching the database", async () => {
    await expect(writeContent(noDatabase, "venue-news", { version: "v", items: [{ id: "a" }] })).rejects.toThrow();
    await expect(writeContent(noDatabase, "venue-news", { items: [] })).rejects.toThrow(/version/);
    await expect(writeContent(noDatabase, "institutions", { institutions: [{}] })).rejects.toThrow(/slug/);
  });

  it("tells the owner to publish a release after institutions", () => {
    const markdown = renderContentReport({ kind: "institutions", outcome: "written", counts: { institutions: 5, places: 6, merged: 0 } });
    expect(markdown).toContain("| places | 6 |");
    expect(markdown).toContain("release.publish");
  });
});
