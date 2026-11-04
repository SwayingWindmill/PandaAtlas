import { describe, expect, it } from "vitest";

import { newsDate, newsDetail, sourceHost, updatedDay } from "./format";

const now = new Date("2026-11-04T12:00:00+09:00");
const item = {
  id: "a",
  institutionSlug: "z",
  kind: "enclosure",
  headline: "h",
  pandaSlugs: [],
  sourceUrl: "https://www.example.org/n/1",
  sourcePublisher: "园方",
  publishedOn: "2026-10-01",
  updatedAt: "2026-10-01T23:30:00Z",
};

describe("venue news", () => {
  it("formats dates", () => {
    expect(newsDate("2026-10-01", now)).toBe("10月1日");
    expect(newsDate("2025-10-01", now)).toBe("2025年10月1日");
  });
  it("dates updatedAt in China time", () => {
    expect(updatedDay("2026-10-01T23:30:00Z")).toBe("2026-10-02");
  });
  it("shows publisher, host and both dates", () => {
    expect(sourceHost(item.sourceUrl)).toBe("example.org");
    expect(newsDetail(item, now)).toBe("园方 · 10月1日\nexample.org · 更新于 10月2日");
  });
});
