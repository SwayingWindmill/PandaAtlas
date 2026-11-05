import { describe, expect, it } from "vitest";
import {
  OverseasStatusCatalogError,
  publishedOverseasStatus,
} from "../src/modules/overseas-status/application/overseas-status-catalog.js";

function item(overrides: Record<string, unknown> = {}) {
  return {
    status: "published",
    pandaSlug: "p-a",
    stage: "abroad",
    institutionSlug: "zoo-a",
    sourceUrl: "https://example.org/notice",
    sourcePublisher: "园方",
    updatedAt: "2026-10-02T09:00:00+08:00",
    ...overrides,
  };
}

const row = (items: unknown[]) => ({ version: "v1", document: { version: "v1", items } });

describe("publishedOverseasStatus", () => {
  it("is empty without a catalog", () => {
    expect(publishedOverseasStatus(null).items).toEqual([]);
  });

  it("drops drafts and orders nearest to home first", () => {
    const result = publishedOverseasStatus(
      row([
        item({ pandaSlug: "p-a" }),
        item({ pandaSlug: "p-b", stage: "quarantine", institutionSlug: "base-a" }),
        item({ pandaSlug: "p-c", status: "draft" }),
        item({ pandaSlug: "p-d", stage: "return_announced", expectedReturn: { on: "2027-02", precision: "month" } }),
        item({ pandaSlug: "p-e", stage: "returned", returnedOn: "2026-01-05" }),
      ]),
    );
    expect(result.items.map((i) => i.pandaSlug)).toEqual(["p-b", "p-d", "p-a", "p-e"]);
    expect(result.items[0]).not.toHaveProperty("status");
  });

  it.each([
    [{ stage: "gone" }],
    [{ sourceUrl: "http://example.org" }],
    [{ expectedReturn: { on: "2027-02-30", precision: "day" } }],
    [{ expectedReturn: { on: "2027", precision: "month" } }],
    [{ stage: "returned" }],
    [{ returnedOn: "2026-01-05" }],
    [{ note: "x" }],
  ])("rejects %j", (overrides) => {
    expect(() => publishedOverseasStatus(row([item(overrides)]))).toThrow(OverseasStatusCatalogError);
  });

  it("rejects duplicate pandas", () => {
    expect(() => publishedOverseasStatus(row([item(), item({ status: "draft" })]))).toThrow(OverseasStatusCatalogError);
  });
});
