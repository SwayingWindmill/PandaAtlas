import { describe, expect, it } from "vitest";

import { partialDate, returnMeta, returnSections, updatedDay } from "./format";
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

  it("puts returns coming first, then each year newest first, then the pandas abroad", () => {
    const sections = returnSections([
      item({ pandaSlug: "a" }),
      item({ pandaSlug: "b", stage: "returned", returnedOn: "2026-01-28", institutionSlug: "ueno" }),
      item({ pandaSlug: "c", stage: "returned", returnedOn: "2026-01-28", institutionSlug: "ueno" }),
      item({ pandaSlug: "d", stage: "returned", returnedOn: "2024-10-12" }),
      item({ pandaSlug: "e", stage: "returned", returnedOn: "2026-03-01" }),
      item({ pandaSlug: "f", stage: "in_transit" }),
      item({ pandaSlug: "g", stage: "quarantine" }),
    ]);
    expect(sections.map((section) => section.title)).toEqual(["即将归国", "2026", "2024", "旅居海外"]);
    expect(sections[0]!.groups.map((group) => group.stage)).toEqual(["quarantine", "in_transit"]);
    expect(sections[1]!.groups.map((group) => group.items.map((i) => i.pandaSlug).join())).toEqual(["e", "b,c"]);
  });

  it("says the day home, the stage, or the expected date", () => {
    const [returned] = returnSections([item({ stage: "returned", returnedOn: "2026-01-28" })])[0]!.groups;
    expect(returnMeta(returned!)).toBe("01.28");
    const [coming] = returnSections([item({ stage: "quarantine" })])[0]!.groups;
    expect(returnMeta(coming!)).toBe("检疫中");
    const [announced] = returnSections([item({ stage: "return_announced", expectedReturn: { on: "2027-02", precision: "month" } })])[0]!.groups;
    expect(returnMeta(announced!)).toBe("预计2027年2月");
  });
});
