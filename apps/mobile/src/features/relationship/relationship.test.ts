import { describe, expect, it } from "vitest";

import { type KinPanda, type ParentLink, buildGraph, relate } from "./relationship";

// A small family:
//   爷爷 G + 奶奶 H → 爸爸 F, 姑姑 T;   外公 MG → 妈妈 M
//   F + M → A (2020), 哥哥 S (2018);   F + Z → 同父异母的弟弟 HS (2022)
//   T + X → 表姐妹 C;   S + Y → 侄子 K
const pandas = new Map<string, KinPanda>(
  (
    [
      ["G", "male", null],
      ["H", "female", null],
      ["MG", "male", null],
      ["F", "male", null],
      ["M", "female", null],
      ["T", "female", null],
      ["X", "male", null],
      ["Z", "female", null],
      ["Y", "female", null],
      ["A", "female", "2020-07-20"],
      ["S", "male", "2018-01-01"],
      ["HS", "male", "2022-08-01"],
      ["C", "female", null],
      ["K", "male", null],
      ["Q", null, null],
    ] as const
  ).map(([id, sex, birthDate]) => [id, { id, name: id, sex, birthDate }]),
);

const link = (childId: string, father: string | null, mother: string | null): ParentLink[] => [
  ...(father ? [{ childId, parentId: father, parentRole: "father" as const }] : []),
  ...(mother ? [{ childId, parentId: mother, parentRole: "mother" as const }] : []),
];

const graph = buildGraph([
  ...link("F", "G", "H"),
  ...link("T", "G", "H"),
  ...link("M", "MG", null),
  ...link("A", "F", "M"),
  ...link("S", "F", "M"),
  ...link("HS", "F", "Z"),
  ...link("C", "X", "T"),
  ...link("K", "S", "Y"),
]);

const term = (a: string, b: string) => relate(graph, pandas, a, b)?.term;

describe("relate", () => {
  it("names parents, children and grandparents by side", () => {
    expect(term("A", "F")).toBe("爸爸");
    expect(term("F", "A")).toBe("女儿");
    expect(term("A", "G")).toBe("爷爷");
    expect(term("A", "H")).toBe("奶奶");
    expect(term("A", "MG")).toBe("外公");
    expect(term("G", "A")).toBe("孙女");
    expect(term("MG", "S")).toBe("外孙");
    expect(term("G", "K")).toBe("往下第 3 代的后代");
  });

  it("orders siblings by birth date and marks half-siblings", () => {
    expect(term("A", "S")).toBe("哥哥");
    expect(term("S", "A")).toBe("妹妹");
    expect(term("A", "HS")).toBe("同父异母的弟弟");
  });

  it("names aunts, cousins and nephews through the right side of the family", () => {
    expect(term("A", "T")).toBe("姑姑");
    expect(term("A", "C")).toBe("表姐妹");
    expect(term("A", "K")).toBe("侄子");
  });

  it("walks the chain from the first panda to the second", () => {
    expect(relate(graph, pandas, "A", "G")?.steps).toEqual([
      { pandaId: "F", label: "爸爸" },
      { pandaId: "G", label: "爸爸" },
    ]);
    // Up to a shared parent, then down: A → 爸爸 or 妈妈 → 儿子 S → 儿子 K.
    expect(relate(graph, pandas, "A", "K")?.steps.slice(1)).toEqual([
      { pandaId: "S", label: "儿子" },
      { pandaId: "K", label: "儿子" },
    ]);
  });

  it("links pandas without a common ancestor through shared cubs, and leaves strangers unrelated", () => {
    expect(relate(graph, pandas, "F", "M")).toEqual({
      term: null,
      steps: [
        { pandaId: "A", label: "女儿" },
        { pandaId: "M", label: "妈妈" },
      ],
    });
    expect(relate(graph, pandas, "A", "Q")).toBeNull();
    expect(relate(graph, pandas, "A", "A")).toBeNull();
  });
});
