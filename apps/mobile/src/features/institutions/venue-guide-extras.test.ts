import { describe, expect, it } from "vitest";

import {
  VENUE_GUIDE_EXTRAS,
  buildPreTripBento,
  buildVenueMetrics,
  mergePhotoSpots,
  mergePracticalTips,
  summarizeTicket,
} from "./venue-guide-extras";
import type { Facility } from "./institutions";

function makeFacility(partial: Partial<Facility> = {}): Facility {
  return {
    id: "fac-1",
    name: "主园区",
    guide: [],
    tips: [],
    verifiedOn: null,
    sourceUrls: [],
    coordinates: null,
    viewing: null,
    photoSpots: [],
    ...partial,
  };
}

describe("venue-guide-extras", () => {
  it("prioritizes API admission over static ticket fallback", () => {
    const facilities = [makeFacility({ guide: [{ label: "门票", value: "16 至 64 岁 600 日元" }] })];
    expect(summarizeTicket(facilities, VENUE_GUIDE_EXTRAS["chengdu-research-base"])).toEqual({
      value: "600 日元",
      sub: "16 至 64 岁 600 日元",
    });
    expect(summarizeTicket([makeFacility({ guide: [{ label: "门票", value: "免费，需官网预约。" }] })], undefined)).toEqual({
      value: "免费",
      sub: "需官网预约",
    });
    expect(summarizeTicket([], undefined)).toEqual({
      value: "—",
      sub: "以官方公布为准",
      muted: true,
    });
  });

  it("builds 3-column metrics with calm dashes for unrecorded data", () => {
    const metrics = buildVenueMetrics({
      slug: "unknown-zoo",
      residents: [],
      former: [],
      bornHere: 0,
      facilities: [],
    });
    expect(metrics.map((m) => [m.key, m.value, m.muted])).toEqual([
      ["residents", "—", true],
      ["born", "—", true],
      ["ticket", "—", true],
    ]);
  });

  it("builds scannable pre-trip bento from API hours/viewing and curated duration", () => {
    const bento = buildPreTripBento({
      slug: "chengdu-research-base",
      facilities: [
        makeFacility({
          guide: [{ label: "开放时间", value: "常规开放 7:30 至 18:00，17:00 停止入园。" }],
        }),
      ],
    });
    expect(bento.map((b) => b.key)).toEqual(["hours", "ticket", "bestWindow", "duration"]);
    expect(bento[0]).toMatchObject({ label: "开放时间", value: "07:30–18:00", sub: "17:00 停止入园" });
    expect(bento[1]).toMatchObject({ label: "门票预约", value: "¥55" });
  });

  it("merges API photo spots and practical tips without duplicating entries", () => {
    const extras = VENUE_GUIDE_EXTRAS["chengdu-research-base"];
    const spots = mergePhotoSpots(
      [makeFacility({ photoSpots: [{ name: "月亮产房室外木栈道", window: { start: "08:00", end: "10:30" } }] })],
      extras,
    );
    expect(spots.filter((s) => s.name === "月亮产房室外木栈道")).toHaveLength(1);
    expect(spots).toHaveLength(2);

    const tips = mergePracticalTips(
      [makeFacility({ tips: [{ label: "怎么去", text: "地铁直达" }] })],
      extras,
    );
    expect(tips[0]).toEqual({ kind: "info", title: "怎么去", text: "地铁直达" });
    expect(tips.length).toBeGreaterThan(1);
  });
});
