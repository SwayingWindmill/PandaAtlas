import { describe, expect, it } from "vitest";

import { comparePandas } from "./order";

const panda = (slug: string, deceased = false) => ({ slug, deceased });

describe("comparePandas", () => {
  it("runs Chinese-named and English-only pandas together in romanized order", () => {
    const sorted = [panda("happy"), panda("bo-si"), panda("a-bao"), panda("cc"), panda("bao-bao")].sort(comparePandas);
    expect(sorted.map((item) => item.slug)).toEqual(["a-bao", "bao-bao", "bo-si", "cc", "happy"]);
  });

  it("keeps living pandas ahead of those that have died", () => {
    const sorted = [panda("a-bao", true), panda("zhen-zhen")].sort(comparePandas);
    expect(sorted.map((item) => item.slug)).toEqual(["zhen-zhen", "a-bao"]);
  });

  it("orders numbered slugs by their number", () => {
    const sorted = [panda("mei-xiang-10"), panda("mei-xiang-2")].sort(comparePandas);
    expect(sorted.map((item) => item.slug)).toEqual(["mei-xiang-2", "mei-xiang-10"]);
  });
});
