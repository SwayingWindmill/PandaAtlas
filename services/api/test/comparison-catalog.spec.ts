import { describe, expect, it } from "vitest";
import { ComparisonCatalogError, publishedComparisons } from "../src/modules/comparisons/application/comparison-catalog.js";

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    status: "published",
    title: "双胞胎姐妹",
    dek: "同一天出生，看耳朵和眼斑",
    pandaSlugs: ["p-a", "p-b"],
    updatedAt: "2026-10-02T09:00:00+08:00",
    ...overrides,
  };
}

const row = (items: unknown[]) => ({ version: "v1", document: { version: "v1", items } });

describe("publishedComparisons", () => {
  it("is empty when no row is stored", () => {
    expect(publishedComparisons(null)).toEqual({ version: "", items: [] });
  });

  it("drops drafts and status, newest first", () => {
    const list = publishedComparisons(
      row([item(), item({ id: "b", updatedAt: "2026-10-05T09:00:00+08:00" }), item({ id: "c", status: "draft" })]),
    );
    expect(list.items.map((entry) => entry.id)).toEqual(["b", "a-1"]);
    expect(list.items[0]).not.toHaveProperty("status");
  });

  it.each([
    ["one panda", { pandaSlugs: ["p-a"] }],
    ["the same panda twice", { pandaSlugs: ["p-a", "p-a"] }],
    ["a title over 16 characters", { title: "一二三四五六七八九十一二三四五六七" }],
    ["an empty dek", { dek: " " }],
    ["updatedAt without offset", { updatedAt: "2026-10-02T09:00:00" }],
    ["an unknown key", { sourceUrl: "https://example.org" }],
  ])("refuses %s", (_, overrides) => {
    expect(() => publishedComparisons(row([item(overrides)]))).toThrow(ComparisonCatalogError);
  });

  it("refuses a duplicate id and a version that does not match", () => {
    expect(() => publishedComparisons(row([item(), item()]))).toThrow(ComparisonCatalogError);
    expect(() => publishedComparisons({ version: "v2", document: { version: "v1", items: [] } })).toThrow(ComparisonCatalogError);
  });
});
