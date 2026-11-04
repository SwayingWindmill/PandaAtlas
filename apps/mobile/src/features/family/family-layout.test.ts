import { describe, expect, it } from "vitest";

import type { Family, FamilyMember } from "@/features/family/family";
import { layoutFamily } from "./family-layout";
import { matchLines, transitionOffset } from "./family-transition";

function member(id: string): FamilyMember {
  return { id, slug: id, name: id, sex: null, birthDate: null, deceased: false, photoUrl: null, relation: "" };
}

describe("family portrait connectors", () => {
  it("uses a shared rail to connect portraits and joins both parents at their portrait edges", () => {
    const focus = member("focus");
    const sibling = member("sibling");
    const family: Family = {
      focus,
      father: member("father"),
      mother: member("mother"),
      generation: [{ members: [focus, sibling], twins: true }],
      children: [member("child")],
    };
    const layout = layoutFamily(family, 390);
    const paths = layout.lines.map((line) => line.path);
    const find = (id: string) => {
      const card = layout.cards.find((item) => item.member.id === id);
      if (!card) throw new Error(`Missing card: ${id}`);
      return card;
    };
    const father = find("father");
    const mother = find("mother");
    const parentY = father.y + 8 + 24;
    expect(paths).toContain(`M${father.x + father.width / 2 + 24} ${parentY}H${mother.x + mother.width / 2 - 24}`);
    for (const id of ["focus", "sibling", "child"]) {
      const card = find(id);
      const x = card.x + card.width / 2;
      const y = card.y + 8;
      expect(paths.some((line) => line.startsWith(`M${x} ${y}V`) || (line.includes(`${x} `) && line.endsWith(`V${y}`)))).toBe(true);
    }
    const selected = find("focus");
    const child = find("child");
    expect(paths).toContain(`M${selected.x + selected.width / 2} ${selected.y + selected.height}V${child.y + 8}`);
  });

  it("does not connect a half sibling to both parents", () => {
    const focus = member("focus");
    const sibling = { ...member("sibling"), relation: "同母异父的哥哥" };
    const family: Family = {
      focus,
      father: member("father"),
      mother: member("mother"),
      generation: [{ members: [focus], twins: false }, { members: [sibling], twins: false }],
      children: [],
    };
    const layout = layoutFamily(family, 390);
    const paths = layout.lines.map((line) => line.path);
    const card = layout.cards.find((item) => item.member.id === "sibling")!;
    const x = card.x + card.width / 2;
    const y = card.y + 8;
    expect(paths.some((line) => line.includes(`${x} `) && line.endsWith(`V${y}`))).toBe(false);
  });

  it("connects a single parent's information block directly to the child", () => {
    const focus = member("focus");
    const family: Family = {
      focus,
      father: null,
      mother: member("mother"),
      generation: [{ members: [focus], twins: false }],
      children: [],
    };
    const layout = layoutFamily(family, 320);
    const paths = layout.lines.map((line) => line.path);
    const parent = layout.cards.find((card) => card.member.id === "mother")!;
    const child = layout.cards.find((card) => card.member.id === "focus")!;
    expect(paths).toContain(`M${parent.x + parent.width / 2} ${parent.y + parent.height}V${child.y + 8}`);
  });

  it("aligns old positions with the new viewport when a wide tree recenters", () => {
    const sibling = member("sibling");
    const focus = member("focus");
    const family: Family = {
      focus,
      father: null,
      mother: null,
      generation: [{ members: [sibling], twins: false }, { members: [focus], twins: false }],
      children: [],
    };
    const previous = layoutFamily(family, 120);
    const next = layoutFamily({
      ...family,
      focus: sibling,
      generation: [{ members: [sibling], twins: false }, { members: [focus], twins: false }],
    }, 120);
    const oldFocus = previous.cards.find((card) => card.kind === "focus")!;
    const newFocus = next.cards.find((card) => card.kind === "focus")!;
    const oldScroll = Math.max(0, Math.min(previous.width - 120, oldFocus.x + oldFocus.width / 2 - 60));
    const newScroll = Math.max(0, Math.min(next.width - 120, newFocus.x + newFocus.width / 2 - 60));
    expect(transitionOffset(previous, next, 120)).toBe(newScroll - oldScroll);
  });

  it("matches only the same relationship with compatible path commands", () => {
    const previous = [
      { id: "shared", path: "M10 20H30" },
      { id: "changed-shape", path: "M10 20V30" },
      { id: "removed", path: "M10 20V30" },
    ];
    const next = [
      { id: "shared", path: "M20 40H50" },
      { id: "changed-shape", path: "M20 40H50" },
      { id: "added", path: "M20 40V50" },
    ];
    const result = matchLines(previous, next, 5);
    expect(result.matched).toEqual([{ id: "shared", parts: ["M", " ", "H", ""], from: [15, 20, 35], to: [20, 40, 50] }]);
    expect(result.added.map((line) => line.id)).toEqual(["changed-shape", "added"]);
    expect(result.removed).toEqual([
      { id: "changed-shape", path: "M15 20V30" },
      { id: "removed", path: "M15 20V30" },
    ]);
  });

  it("keeps parent relationship identifiers stable when focus changes among siblings", () => {
    const first = member("first");
    const second = member("second");
    const family: Family = {
      focus: first,
      father: member("father"),
      mother: member("mother"),
      generation: [{ members: [first, second], twins: false }],
      children: [],
    };
    const old = layoutFamily(family, 390);
    const next = layoutFamily({ ...family, focus: second }, 390);
    const paths = matchLines(old.lines, next.lines, 0);
    expect(paths.matched.map((line) => line.id)).toContain("parents:father:mother:rail:first:second");
    expect(paths.matched.map((line) => line.id)).toContain("parents:father:mother:couple");
  });
});

describe("family tree at larger text and for VoiceOver", () => {
  const focus = member("focus");
  const family: Family = {
    focus,
    father: member("father"),
    mother: member("mother"),
    generation: [{ members: [member("elder"), focus], twins: false }],
    children: [member("child")],
  };

  it("grows every card with the text size, up to the tree's limit", () => {
    const base = layoutFamily(family, 390);
    const larger = layoutFamily(family, 390, 1.5);
    const largest = layoutFamily(family, 390, 3);
    const height = (layout: typeof base, id: string) => layout.cards.find((card) => card.member.id === id)!.height;
    for (const id of ["father", "focus", "elder", "child"]) {
      expect(height(larger, id)).toBe(height(base, id) + 21);
      expect(height(largest, id)).toBe(height(base, id) + 42);
    }
    const child = larger.cards.find((card) => card.member.id === "child")!;
    expect(larger.height).toBe(child.y + child.height + 16);
  });

  it("lists cards top to bottom, left to right", () => {
    expect(layoutFamily(family, 390).cards.map((card) => card.member.id)).toEqual(["father", "mother", "elder", "focus", "child"]);
  });
});
