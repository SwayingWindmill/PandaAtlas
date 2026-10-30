import { describe, expect, it } from "vitest";

import { DIFFICULTIES, difficultyOf } from "./difficulty";

describe("guess difficulty", () => {
  it("lists the three levels the API accepts, easiest first", () => {
    expect(DIFFICULTIES.map((item) => item.value)).toEqual(["easy", "medium", "hard"]);
  });

  it("explains each level by where the choices live", () => {
    expect(difficultyOf("hard").label).toBe("困难");
    for (const item of DIFFICULTIES) expect(item.meaning).toMatch(/住/);
  });
});
