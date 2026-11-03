import { describe, expect, it } from "vitest";

import { DIFFICULTIES, difficultyOf, offeredLevels } from "./difficulty";

describe("guess difficulty", () => {
  it("lists the three levels the API accepts, easiest first", () => {
    expect(DIFFICULTIES.map((item) => item.value)).toEqual(["easy", "medium", "hard"]);
  });

  it("explains each level by where the choices live", () => {
    expect(difficultyOf("hard").label).toBe("困难");
    for (const item of DIFFICULTIES) expect(item.meaning).toMatch(/住/);
  });
});

describe("offeredLevels", () => {
  it("leaves out a level the server has no question for", () => {
    expect(offeredLevels({ easy: "ready", medium: "ready", hard: "empty" }, "any")).toEqual(["easy", "medium"]);
  });

  it("keeps a level that only failed to load, and levels not probed yet", () => {
    expect(offeredLevels({ easy: "unknown" }, "any")).toEqual(["easy", "medium", "hard"]);
  });

  it("keeps the current level selected even when it turns out empty", () => {
    expect(offeredLevels({ hard: "empty" }, "hard")).toEqual(["easy", "medium", "hard"]);
  });

  it("offers nothing beyond 随机 when every level is empty", () => {
    expect(offeredLevels({ easy: "empty", medium: "empty", hard: "empty" }, "any")).toEqual([]);
  });
});
