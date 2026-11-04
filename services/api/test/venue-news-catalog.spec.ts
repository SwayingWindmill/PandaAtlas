import { describe, expect, it } from "vitest";
import { VenueNewsCatalogError, publishedVenueNews } from "../src/modules/venue-news/application/venue-news-catalog.js";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    status: "published",
    institutionSlug: "zoo-a",
    kind: "enclosure",
    headline: "公告标题",
    pandaSlugs: ["p-a"],
    sourceUrl: "https://example.org/notice",
    sourcePublisher: "园方",
    publishedOn: "2026-10-01",
    updatedAt: "2026-10-02T09:00:00+08:00",
    ...overrides,
  };
}

const row = (items: unknown[]) => ({ version: "v1", document: { version: "v1", items } });

describe("publishedVenueNews", () => {
  it("is empty when no row is stored", () => {
    expect(publishedVenueNews(null)).toEqual({ version: "", items: [] });
  });

  it("drops drafts and status, newest first, filters by institution", () => {
    const news = publishedVenueNews(
      row([item(), item({ id: "b", publishedOn: "2026-10-05" }), item({ id: "c", status: "draft" }), item({ id: "d", institutionSlug: "zoo-b" })]),
      "zoo-a",
    );
    expect(news.items.map((i) => i.id)).toEqual(["b", "a-1"]);
    expect(news.items[0]).not.toHaveProperty("status");
  });

  it.each([
    ["non-https source", { sourceUrl: "http://example.org" }],
    ["missing publisher", { sourcePublisher: "" }],
    ["updatedAt without offset", { updatedAt: "2026-10-02T09:00:00" }],
    ["unknown kind", { kind: "rumor" }],
    ["extra commentary field", { comment: "x" }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => publishedVenueNews(row([item(overrides)]))).toThrow(VenueNewsCatalogError);
  });

  it("rejects duplicate ids", () => {
    expect(() => publishedVenueNews(row([item(), item()]))).toThrow(VenueNewsCatalogError);
  });
});
