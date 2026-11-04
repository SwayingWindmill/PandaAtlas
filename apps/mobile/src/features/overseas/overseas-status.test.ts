import { describe, expect, it } from "vitest";

import { byStage, partialDate, statusDetail, updatedDay } from "./format";
import type { OverseasStatusItem } from "./overseas-status";

const item = (overrides: Partial<OverseasStatusItem> = {}): OverseasStatusItem => ({
  pandaSlug: "p-a",
  stage: "abroad",
  institutionSlug: "zoo-a",
  sourceUrl: "https://www.example.org/n",
  sourcePublisher: "园方",
  updatedAt: "2026-10-01T20:00:00Z",
  ...overrides,
});

describe("overseas status format", () => {
  it("keeps the announcement's precision", () => {
    expect(partialDate({ on: "2027", precision: "year" })).toBe("2027年");
    expect(partialDate({ on: "2027-02", precision: "month" })).toBe("2027年2月");
    expect(partialDate({ on: "2027-02-14", precision: "day" })).toBe("2027年2月14日");
  });

  it("dates updates in Asia/Shanghai", () => {
    expect(updatedDay("2026-10-01T20:00:00Z")).toBe("2026-10-02");
  });

  it("writes place, return and source", () => {
    expect(statusDetail(item({ expectedReturn: { on: "2027-02", precision: "month" } }), "某动物园")).toBe(
      "某动物园 · 预计2027年2月\nexample.org · 更新于 2026年10月2日",
    );
    expect(statusDetail(item({ stage: "returned", returnedOn: "2026-01-05" }), "基地").split("\n")[0]).toBe("基地 · 2026年1月5日归国");
  });

  it("groups nearest to home first and drops empty stages", () => {
    const groups = byStage([item(), item({ pandaSlug: "b", stage: "quarantine" })]);
    expect(groups.map((g) => g.label)).toEqual(["检疫中", "旅居海外"]);
  });
});
