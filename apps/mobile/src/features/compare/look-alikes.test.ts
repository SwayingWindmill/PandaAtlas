import { describe, expect, it } from "vitest";

import { lookAlikePairs } from "./look-alikes";

const p = (id: string, birthDate: string | null = null) => ({ id, slug: id, name: id.toUpperCase(), birthDate });

describe("lookAlikePairs", () => {
  const pandas = [p("a", "2020-07-04"), p("b", "2020-07-04"), p("c", "2020-07-05"), p("d"), p("e", "2020")];
  const mother = (childId: string, sourceIds = ["s"]) => ({ childId, parentId: "m", parentRole: "mother" as const, sourceIds });

  it("pairs sourced same-mother same-day births as twins", () => {
    const pairs = lookAlikePairs(pandas, [mother("a"), mother("b"), mother("c")], []);
    expect(pairs.map((x) => [x.kind, x.key])).toEqual([["twins", "a+b"]]);
  });
  it("ignores unsourced links and inexact dates", () => {
    expect(lookAlikePairs(pandas, [mother("a"), mother("b", [])], [])).toEqual([]);
    expect(lookAlikePairs([p("e", "2020"), p("f", "2020")], [mother("e"), mother("f")], [])).toEqual([]);
  });
  it("adds challenge pairs once, after twins", () => {
    const pairs = lookAlikePairs(pandas, [mother("a"), mother("b")], [
      { answerPandaSlug: "b", decoyPandaSlugs: ["a", "d", "zz"] },
    ]);
    expect(pairs.map((x) => [x.kind, x.key])).toEqual([
      ["twins", "a+b"],
      ["challenge", "b+d"],
    ]);
  });
});
