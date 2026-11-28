import { describe, expect, it } from "vitest";

import type { MapItem } from "./model";
import { buildTimeline, eventsInYear, residentsInYear } from "./timeline";

function item(id: string, name: string, placeIds: string[], overseas = false): MapItem {
  return {
    id,
    kind: "institution",
    slug: id,
    name,
    where: null,
    overseas,
    residentCount: 0,
    residentNames: null,
    residents: [],
    point: { x: 0, y: 0 },
    placeIds,
    coordinates: null,
  };
}

const items = [item("bfx", "碧峰峡", ["p-bfx"]), item("wolong", "卧龙", ["p-wl"]), item("ueno", "上野动物园", ["p-ueno"], true)];
const pandas = [
  { id: "a", slug: "li-li", name: "力力" },
  { id: "b", slug: "zhen-zhen", name: "真真" },
  { id: "c", slug: "cub", name: "幼仔" },
];

describe("buildTimeline", () => {
  it("runs from the first record to this year, with a zero for a year without one", () => {
    const timeline = buildTimeline(
      [{ pandaId: "a", placeId: "p-bfx", startOn: "2008-05-01" }],
      [{ eventId: "e", eventType: "birth", occurredOn: "2010-08-01", participantIds: ["c"] }],
      2011,
    );
    expect(timeline.years).toEqual([2008, 2009, 2010, 2011]);
    expect(timeline.counts).toEqual([1, 0, 1, 0]);
  });
});

describe("residentsInYear", () => {
  it("counts the pandas living at each place at the end of the year", () => {
    const residencies = [
      { pandaId: "a", placeId: "p-bfx", startOn: "2005-01-01", endOn: "2011-02-21" },
      { pandaId: "a", placeId: "p-ueno", startOn: "2011-02-21" },
      { pandaId: "b", placeId: "p-ueno", startOn: "2011-02-21" },
    ];
    expect(residentsInYear(items, residencies, 2010).get("bfx")).toBe(1);
    expect(residentsInYear(items, residencies, 2011).get("bfx")).toBeUndefined();
    expect(residentsInYear(items, residencies, 2011).get("ueno")).toBe(2);
  });
});

describe("eventsInYear", () => {
  it("names a move abroad, a birth and a death, oldest first", () => {
    const events = [
      { eventId: "d", eventType: "death", occurredOn: "2011-12-01", participantIds: ["c"] },
      { eventId: "m", eventType: "transfer", occurredOn: "2011-02-21", fromPlaceId: "p-bfx", toPlaceId: "p-ueno", participantIds: ["a", "b"] },
      { eventId: "b", eventType: "birth", occurredOn: "2011-08-01", toPlaceId: "p-wl", participantIds: ["c"] },
    ];
    const list = eventsInYear(items, events, pandas, 2011);
    expect(list.map((event) => event.kind)).toEqual(["abroad", "birth", "death"]);
    expect(list[0]).toMatchObject({ who: "力力、真真", what: "碧峰峡 → 上野动物园", when: "2 月 21 日", from: "bfx", to: "ueno" });
    expect(list[1]).toMatchObject({ what: "在卧龙出生", when: "8 月" });
    expect(list[2]).toMatchObject({ what: "已离世" });
  });

  it("leaves out events whose pandas are not published", () => {
    expect(eventsInYear(items, [{ eventId: "x", eventType: "birth", occurredOn: "2011-01-02", participantIds: ["nobody"] }], pandas, 2011)).toEqual([]);
  });
});
