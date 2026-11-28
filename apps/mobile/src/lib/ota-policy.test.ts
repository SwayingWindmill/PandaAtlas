import { describe, expect, it } from "vitest";

import { criticalIndex, updateAction } from "./ota-policy";

describe("updateAction: what a downloaded OTA update does to the running app", () => {
  it("waits for the next cold start for an ordinary update, so a fan is never interrupted", () => {
    expect(updateAction(0, 0)).toBe("next-launch");
    expect(updateAction(3, 3)).toBe("next-launch");
  });

  it("reloads at once for an update marked more critical than the running bundle", () => {
    expect(updateAction(0, 1)).toBe("reload-now");
    expect(updateAction(2, 5)).toBe("reload-now");
  });

  it("never reloads for an older mark, as a rollback to an earlier bundle carries one", () => {
    expect(updateAction(4, 2)).toBe("next-launch");
  });
});

describe("criticalIndex: the mark in an app config's extra", () => {
  it("reads a whole non-negative number", () => {
    expect(criticalIndex({ otaCriticalIndex: 2 })).toBe(2);
  });

  it("treats a missing or malformed mark as 0", () => {
    expect(criticalIndex(undefined)).toBe(0);
    expect(criticalIndex({})).toBe(0);
    expect(criticalIndex({ otaCriticalIndex: "3" })).toBe(0);
    expect(criticalIndex({ otaCriticalIndex: -1 })).toBe(0);
    expect(criticalIndex({ otaCriticalIndex: 1.5 })).toBe(0);
  });
});
