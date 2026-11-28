import { describe, expect, it } from "vitest";

import { daysUntil, dotDate, sourceHost, updatedDay } from "./format";
import { mergePandaNewsItems, type VenueNewsItem } from "./merge";

const now = new Date("2026-11-04T12:00:00+09:00");

function makeItem(overrides: Partial<VenueNewsItem> & { id: string }): VenueNewsItem {
  return {
    institutionSlug: "chengdu-research-base",
    kind: "notice",
    headline: `标题 ${overrides.id}`,
    pandaSlugs: ["hua-hua"],
    sourceUrl: `https://example.org/${overrides.id}`,
    sourcePublisher: "成都大熊猫繁育研究基地",
    publishedOn: "2026-11-01",
    updatedAt: "2026-11-01T08:00:00Z",
    ...overrides,
  };
}

describe("venue news", () => {
  it("dates updatedAt in China time", () => {
    expect(updatedDay("2026-10-01T23:30:00Z")).toBe("2026-10-02");
  });

  it("shows the source host", () => {
    expect(sourceHost("https://www.example.org/n/1")).toBe("example.org");
  });

  it("dates the timeline and counts down in China time", () => {
    expect(dotDate("2026-11-06")).toBe("2026.11.06");
    expect(daysUntil("2026-11-06", now)).toBe(2);
    expect(daysUntil("2026-11-04", now)).toBe(0);
    expect(daysUntil("2026-10-01", now)).toBeLessThan(0);
    expect(daysUntil("2026-11-05", new Date("2026-11-04T17:00:00Z"))).toBe(0);
  });

  it("merges venue and panda news, deduplicates URLs, filters http links, and caps length", () => {
    const curated = [
      makeItem({
        id: "curated-dup",
        headline: "官方原版闭园提醒",
        sourceUrl: "https://weibo.com/100/dup",
        publishedOn: "2026-11-02",
        updatedAt: "2026-11-02T09:00:00Z",
      }),
      makeItem({
        id: "other-panda",
        pandaSlugs: ["fu-bao"],
        sourceUrl: "https://weibo.com/100/other",
        publishedOn: "2026-11-05",
      }),
    ];
    const live = [
      makeItem({
        id: "live-dup",
        headline: "重复采集版本",
        sourceUrl: "https://weibo.com/100/dup",
        publishedOn: "2026-11-02",
        updatedAt: "2026-11-02T10:00:00Z",
      }),
      makeItem({
        id: "insecure",
        sourceUrl: "http://example.org/insecure",
        publishedOn: "2026-11-06",
      }),
      makeItem({
        id: "live-newest",
        sourceUrl: "https://weibo.com/100/newest",
        publishedOn: "2026-11-04",
        updatedAt: "2026-11-04T06:00:00Z",
      }),
      makeItem({
        id: "live-older",
        sourceUrl: "https://weibo.com/100/older",
        publishedOn: "2026-11-01",
      }),
      makeItem({
        id: "live-third",
        sourceUrl: "https://weibo.com/100/third",
        publishedOn: "2026-11-03",
      }),
    ];

    const merged = mergePandaNewsItems(curated, live, "hua-hua");
    expect(merged.map((item) => item.id)).toEqual(["live-newest", "live-third", "curated-dup"]);
    expect(merged[2]?.headline).toBe("官方原版闭园提醒");
  });
});
