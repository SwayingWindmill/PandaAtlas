import { describe, expect, it } from "vitest";

import { keepRecent, offlineEntry } from "./offline-keys";

describe("offlineEntry", () => {
  it("keeps the release-wide lists with their query, and single panda or institution pages", () => {
    expect(offlineEntry("https://api.zhipanda.com/api/v2/pandas")).toEqual({
      key: "offline:/api/v2/pandas",
      page: false,
    });
    expect(offlineEntry("https://api.zhipanda.com/api/v2/updates?limit=10")).toEqual({
      key: "offline:/api/v2/updates?limit=10",
      page: false,
    });
    expect(offlineEntry("https://api.zhipanda.com/api/v2/learning")).toEqual({
      key: "offline:/api/v2/learning",
      page: false,
    });
    expect(offlineEntry("https://api.zhipanda.com/api/v2/pandas/fu-bao")).toEqual({
      key: "offline:/api/v2/pandas/fu-bao",
      page: true,
    });
  });

  it("leaves out personal, game and cover reads", () => {
    for (const path of [
      "/api/v2/me/favorites",
      "/api/v2/games/guess/question",
      "/api/v2/panda-covers?ids=a",
      "/api/v2/evidence/s1",
    ]) {
      expect(offlineEntry(`https://api.zhipanda.com${path}`)).toBeNull();
    }
  });
});

describe("keepRecent", () => {
  it("moves the opened page to the front and drops the oldest past the limit", () => {
    expect(keepRecent(["b", "a"], "c", 2)).toEqual({ pages: ["c", "b"], drop: ["a"] });
    expect(keepRecent(["b", "a"], "a", 2)).toEqual({ pages: ["a", "b"], drop: [] });
  });
});
