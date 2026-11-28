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
    expect(offlineEntry("https://api.zhipanda.com/api/v2/venue-news?institution=chengdu-research-base")).toEqual({
      key: "offline:/api/v2/venue-news?institution=chengdu-research-base",
      page: false,
    });
    expect(offlineEntry("https://api.zhipanda.com/api/v2/comparisons")).toEqual({
      key: "offline:/api/v2/comparisons",
      page: false,
    });
    expect(offlineEntry("https://api.zhipanda.com/api/v2/news?panda=he-hua-chengdu&limit=5")).toEqual({
      key: "offline:/api/v2/news?panda=he-hua-chengdu&limit=5",
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

  it("never evicts pinned pack keys when unpinned pages exceed the limit", () => {
    const pinned = new Set(["offline:/api/v2/pandas/pinned-1", "offline:/api/v2/institutions/chengdu"]);
    expect(keepRecent(["offline:/api/v2/pandas/pinned-1", "u2", "u1"], "u3", 2, pinned)).toEqual({
      pages: ["u3", "u2"],
      drop: ["u1"],
    });
    expect(keepRecent(["u2", "u1"], "offline:/api/v2/pandas/pinned-1", 2, pinned)).toEqual({
      pages: ["u2", "u1"],
      drop: [],
    });
  });
});
