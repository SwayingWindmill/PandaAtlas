import { describe, expect, it } from "vitest";

import { buildBook, entryCaption, progressPercent } from "./book";

describe("buildBook", () => {
  it("counts each panda once, however it was met, and lists the newest meeting first", () => {
    const view = buildBook(
      {
        publishedCount: 925,
        items: [
          { pandaId: "fu-bao", firstGame: "daily_panda", lastMetAt: "2026-07-20T08:00:00Z" },
          { pandaId: "meng-lan", firstGame: "guess_panda", lastMetAt: "2026-07-09T08:00:00Z" },
        ],
      },
      [
        { pandaId: "he-hua", seenOn: "2026-07-12", updatedAt: "2026-07-12T10:00:00Z" },
        { pandaId: "meng-lan", seenOn: "2026-07-30", updatedAt: "2026-07-30T10:00:00Z" },
      ],
    );
    expect(view.knownCount).toBe(3);
    expect(view.byWay).toEqual({ daily_panda: 1, guess_panda: 1, seen: 2 });
    expect(view.recent.map((entry) => [entry.pandaId, entry.through])).toEqual([
      ["meng-lan", "seen"],
      ["fu-bao", "daily_panda"],
      ["he-hua", "seen"],
    ]);
  });

  it("falls back to when a 见过 was recorded when it has no day", () => {
    const view = buildBook({ publishedCount: 1, items: [] }, [{ pandaId: "a", seenOn: null, updatedAt: "2026-10-26T01:00:00Z" }]);
    expect(entryCaption(view.recent[0]!)).toBe("10/26 去现场见过");
  });
});

describe("progressPercent", () => {
  it("shows at least 1% once anything is known, and 0% for nothing", () => {
    expect(progressPercent({ knownCount: 7, publishedCount: 925 })).toBe(1);
    expect(progressPercent({ knownCount: 0, publishedCount: 925 })).toBe(0);
    expect(progressPercent({ knownCount: 463, publishedCount: 925 })).toBe(50);
  });
});
