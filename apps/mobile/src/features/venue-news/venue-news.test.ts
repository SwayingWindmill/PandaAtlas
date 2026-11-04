import { describe, expect, it } from "vitest";

import { daysUntil, dotDate, sourceHost, updatedDay } from "./format";

const now = new Date("2026-11-04T12:00:00+09:00");

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
});
