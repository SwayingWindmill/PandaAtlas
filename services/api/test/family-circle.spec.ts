import { describe, expect, it } from "vitest";

import { familyCircleIds } from "../src/modules/publication/application/family-circle.js";

// grandma -> mom -> {focus, sister}; dad -> focus; focus -> cub; unrelated stays out.
const edges = [
  { parentId: "grandma", childId: "mom" },
  { parentId: "mom", childId: "focus" },
  { parentId: "mom", childId: "sister" },
  { parentId: "dad", childId: "focus" },
  { parentId: "focus", childId: "cub" },
  { parentId: "cub", childId: "grandcub" },
  { parentId: "stranger-parent", childId: "stranger" },
];

describe("familyCircleIds", () => {
  it("returns parents, siblings, grandparents and children of the focus panda", () => {
    expect(familyCircleIds("focus", edges)).toEqual(["cub", "dad", "grandma", "mom", "sister"]);
  });

  it("excludes the focus panda, more distant generations and unrelated pandas", () => {
    const ids = familyCircleIds("focus", edges);
    expect(ids).not.toContain("focus");
    expect(ids).not.toContain("grandcub");
    expect(ids).not.toContain("stranger");
  });

  it("returns an empty circle for a panda without recorded parentage", () => {
    expect(familyCircleIds("stranger-parent-2", edges)).toEqual([]);
  });
});
