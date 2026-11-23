import { describe, expect, it } from "vitest";

import type { MapItem } from "@/features/map/model";

import { buildLiveClockCards, localClockOf, venueActivityStatus } from "./venue-clock";

function mapVenue(slug: string, name: string, residentCount: number): MapItem {
  return {
    id: `institution:${slug}`,
    kind: "institution",
    slug,
    name,
    where: "美国",
    overseas: slug !== "chengdu-research-base",
    residentCount,
    residentNames: null,
    residents: [{ id: `p-${slug}`, slug: `p-${slug}`, name: "熊猫", hasFullBleedCover: true }],
    point: null,
    placeIds: [],
    coordinates: null,
  };
}

describe("localClockOf", () => {
  it("converts UTC instants accurately across winter standard time and summer DST", () => {
    // Late Nov: EST (UTC-5), PST (UTC-8), CST (UTC+8)
    const winter = new Date("2026-11-23T14:15:00Z");
    expect(localClockOf(winter, "Asia/Shanghai")).toEqual({ hhmm: "22:15", minutes: 22 * 60 + 15 });
    expect(localClockOf(winter, "America/New_York")).toEqual({ hhmm: "09:15", minutes: 9 * 60 + 15 });
    expect(localClockOf(winter, "America/Los_Angeles")).toEqual({ hhmm: "06:15", minutes: 6 * 60 + 15 });

    // Mid July: EDT (UTC-4), CEST (UTC+2), CST (UTC+8)
    const summer = new Date("2026-07-15T14:15:00Z");
    expect(localClockOf(summer, "Asia/Shanghai")).toEqual({ hhmm: "22:15", minutes: 22 * 60 + 15 });
    expect(localClockOf(summer, "America/New_York")).toEqual({ hhmm: "10:15", minutes: 10 * 60 + 15 });
    expect(localClockOf(summer, "Europe/Vienna")).toEqual({ hhmm: "16:15", minutes: 16 * 60 + 15 });
  });

  it("normalizes midnight clocks to 00:xx instead of 24:xx", () => {
    const midnightChina = new Date("2026-11-23T16:05:00Z");
    const clock = localClockOf(midnightChina, "Asia/Shanghai");
    expect(clock).toEqual({ hhmm: "00:05", minutes: 5 });
  });
});

describe("venueActivityStatus", () => {
  const sampleSpec = {
    active: [
      { start: "08:00", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
  };

  it("identifies active, nap, daytime open transitions, upcoming, and closed windows", () => {
    expect(venueActivityStatus(9 * 60, sampleSpec)).toBe("active");
    expect(venueActivityStatus(11 * 60 + 45, sampleSpec)).toBe("open");
    expect(venueActivityStatus(12 * 60 + 30, sampleSpec)).toBe("nap");
    expect(venueActivityStatus(14 * 60 + 15, sampleSpec)).toBe("open");
    expect(venueActivityStatus(6 * 60 + 15, sampleSpec)).toBe("upcoming");
    expect(venueActivityStatus(22 * 60, sampleSpec)).toBe("closed");
  });
});

describe("buildLiveClockCards", () => {
  it("surfaces awake overseas live-cam venues when China venues are resting at night", () => {
    const nightInChina = new Date("2026-11-23T14:15:00Z");
    const cards = buildLiveClockCards(
      [
        mapVenue("chengdu-research-base", "成都大熊猫繁育研究基地", 17),
        mapVenue("san-diego-zoo", "圣地亚哥动物园", 2),
        mapVenue("smithsonian-national-zoo", "史密森国家动物园", 2),
      ],
      [],
      nightInChina,
    );
    expect(cards.map((c) => c.slug)).toEqual([
      "smithsonian-national-zoo",
      "san-diego-zoo",
      "chengdu-research-base",
    ]);
    expect(cards[0]?.status).toBe("active");
    expect(cards[0]?.liveCamUrl).toBe("https://nationalzoo.si.edu/webcams/panda-cam");
    expect(cards[1]?.status).toBe("upcoming");
    expect(cards[2]?.status).toBe("closed");
  });

  it("classifies daytime gaps between active windows and naps as open instead of closed", () => {
    const noonGapInChina = new Date("2026-11-23T03:45:00Z"); // 11:45 CST
    const cards = buildLiveClockCards(
      [mapVenue("chengdu-research-base", "成都大熊猫繁育研究基地", 17)],
      [],
      noonGapInChina,
    );
    expect(cards[0]?.status).toBe("open");
    expect(cards[0]?.statusLabel).toBe("开园中");
  });

  it("handles unknown synthetic venues safely using the default schedule", () => {
    const morningInChina = new Date("2026-11-23T01:30:00Z"); // 09:30 CST
    const cards = buildLiveClockCards([mapVenue("fixture-zoo", "测试动物园", 3)], [], morningInChina);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.status).toBe("active");
    expect(cards[0]?.localTime).toBe("09:30");
  });
});
