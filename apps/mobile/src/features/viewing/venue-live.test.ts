import { describe, expect, it } from "vitest";

import { buildVenueLiveSnapshot, resolveVenueLiveCamUrl } from "./venue-live";

describe("venue-live", () => {
  it("resolves API liveCamUrl ahead of static spec and falls back to static spec", () => {
    expect(resolveVenueLiveCamUrl("chengdu-research-base", "https://example.org/custom-live")).toBe(
      "https://example.org/custom-live",
    );
    expect(resolveVenueLiveCamUrl("chengdu-research-base", null)).toBe("https://www.ipanda.com/");
    expect(resolveVenueLiveCamUrl("beijing-zoo", null)).toBeNull();
    expect(resolveVenueLiveCamUrl("unknown-venue", null)).toBeNull();
  });

  it("returns null for unknown venue slugs instead of fabricating a schedule", () => {
    expect(buildVenueLiveSnapshot("not-in-specs", null, new Date("2026-10-01T02:00:00Z"))).toBeNull();
  });

  it("reports active, nap, and closed states for domestic Chengdu schedule", () => {
    // 10:25 Asia/Shanghai === 02:25Z
    const morning = buildVenueLiveSnapshot("chengdu-research-base", null, new Date("2026-10-01T02:25:00Z"));
    expect(morning).toMatchObject({
      localTime: "10:25",
      status: "active",
      statusLabel: "活跃中",
      hint: "今日观赏指数高",
      openLabel: "07:30 开园",
      peakLabel: "07:30–11:30 活跃高峰",
      closeLabel: "17:00 闭园",
      liveCamUrl: "https://www.ipanda.com/",
    });

    // 12:30 Asia/Shanghai === 04:30Z
    const nap = buildVenueLiveSnapshot("chengdu-research-base", null, new Date("2026-10-01T04:30:00Z"));
    expect(nap).toMatchObject({
      localTime: "12:30",
      status: "nap",
      statusLabel: "午休中",
      hint: "大熊猫午休中",
    });

    // 22:00 Asia/Shanghai === 14:00Z
    const night = buildVenueLiveSnapshot("chengdu-research-base", null, new Date("2026-10-01T14:00:00Z"));
    expect(night).toMatchObject({
      localTime: "22:00",
      status: "closed",
      statusLabel: "夜间休整",
      hint: "闭园休整中",
    });
  });

  it("reports upcoming state in overseas IANA timezones before opening", () => {
    // 2026-10-01T10:30:00Z is 06:30 EDT (America/New_York), within 210m before 08:00 open.
    const earlyMorning = buildVenueLiveSnapshot("smithsonian-national-zoo", null, new Date("2026-10-01T10:30:00Z"));
    expect(earlyMorning).toMatchObject({
      timeZone: "America/New_York",
      localTime: "06:30",
      status: "upcoming",
      statusLabel: "即将开园",
      hint: "即将进入活跃时段",
      liveCamUrl: "https://nationalzoo.si.edu/webcams/panda-cam",
    });
  });
});
