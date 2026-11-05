import { describe, expect, it } from "vitest";

import { rankPopular } from "../src/modules/popularity/application/popular-pandas.js";
import { PopularityApplication } from "../src/modules/popularity/application/popularity.application.js";
import type { PublicReadPort } from "../src/modules/publication/application/public-read.application.js";

const published = new Map([
  ["a", "panda-a"],
  ["b", "panda-b"],
  ["c", "panda-c"],
]);

describe("rankPopular", () => {
  it("orders by new followers, keeps published pandas at the floor, ties by slug", () => {
    const ranked = rankPopular(
      [
        { pandaId: "a", followers: 5 },
        { pandaId: "b", followers: 9 },
        { pandaId: "c", followers: 5 },
        { pandaId: "hidden", followers: 40 },
        { pandaId: "few", followers: 4 },
      ],
      new Map([...published, ["few", "panda-few"]]),
    );
    expect(ranked).toEqual([
      { pandaId: "b", slug: "panda-b" },
      { pandaId: "a", slug: "panda-a" },
      { pandaId: "c", slug: "panda-c" },
    ]);
  });

  it("stops at the limit", () => {
    expect(
      rankPopular(
        [
          { pandaId: "a", followers: 6 },
          { pandaId: "b", followers: 7 },
        ],
        published,
        { limit: 1 },
      ),
    ).toEqual([{ pandaId: "b", slug: "panda-b" }]);
  });
});

describe("PopularityApplication", () => {
  it("counts the last 30 days and is empty without a release", async () => {
    let since: Date | undefined;
    const repository = {
      followCounts: (from: Date) => {
        since = from;
        return Promise.resolve([{ pandaId: "a", followers: 8 }]);
      },
    };
    const release = { releaseId: "r" };
    const ok = {
      listPandas: () => Promise.resolve({ kind: "ok", value: { release, items: [{ pandaId: "a", canonicalSlug: "panda-a" }] } }),
    } as unknown as PublicReadPort;
    const now = () => new Date("2026-11-05T00:00:00Z");
    const popular = await new PopularityApplication(repository, ok, now).popular();
    expect(popular).toEqual({ windowDays: 30, items: [{ pandaId: "a", slug: "panda-a" }] });
    expect(since?.toISOString()).toBe("2026-10-06T00:00:00.000Z");

    const missing = { listPandas: () => Promise.resolve({ kind: "unavailable" }) } as unknown as PublicReadPort;
    expect(await new PopularityApplication(repository, missing, now).popular()).toEqual({ windowDays: 30, items: [] });
  });
});
