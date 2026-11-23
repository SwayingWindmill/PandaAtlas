import { describe, expect, it } from "vitest";

import { highlightParts } from "./highlight";

describe("highlightParts", () => {
  it("splits out the matched characters", () => {
    expect(highlightParts("萌兰", "兰")).toEqual([
      { text: "萌", hit: false },
      { text: "兰", hit: true },
    ]);
  });

  it("ignores case and surrounding spaces", () => {
    expect(highlightParts("Fu Bao", " bao ")).toEqual([
      { text: "Fu ", hit: false },
      { text: "Bao", hit: true },
    ]);
  });

  it("returns null when the query is empty or absent from the text", () => {
    expect(highlightParts("萌兰", "ml")).toBeNull();
    expect(highlightParts("萌兰", "  ")).toBeNull();
  });
});
