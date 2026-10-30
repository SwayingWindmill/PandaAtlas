import { describe, expect, it } from "vitest";

import { heroCandidates, pickInstitutionHero } from "./hero-pick";

const curated = new Map([
  ["a", "aaaa"],
  ["b", "bbbb"],
  ["c", "cccc"],
]);
const resident = (id: string) => ({ id, name: id });
const cover = (pandaId: string, contentSha256: string, creator: string | null = "Zoo") => ({
  pandaId,
  contentSha256,
  creator,
  attributionText: null,
});

describe("heroCandidates", () => {
  it("keeps only residents with a reviewed cover, in page order", () => {
    expect(heroCandidates([resident("x"), resident("b"), resident("a")], curated).map((panda) => panda.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("pickInstitutionHero", () => {
  it("takes the first resident whose cover is the reviewed photo", () => {
    const pick = pickInstitutionHero(
      [resident("a"), resident("b")],
      [cover("b", "bbbb0000"), cover("a", "aaaa0000")],
      curated,
    );
    expect(pick?.panda.id).toBe("a");
  });

  it("skips a cover that was replaced since review", () => {
    const pick = pickInstitutionHero(
      [resident("a"), resident("b")],
      [cover("a", "ffff0000"), cover("b", "bbbb0000")],
      curated,
    );
    expect(pick?.panda.id).toBe("b");
  });

  it("skips a resident whose cover is not curated at all", () => {
    expect(pickInstitutionHero([resident("x")], [cover("x", "aaaa0000")], curated)).toBeNull();
  });

  it("skips a curated cover credited to a watermarking agency", () => {
    const pick = pickInstitutionHero([resident("c")], [cover("c", "cccc0000", "新华社")], curated);
    expect(pick).toBeNull();
  });

  it("returns null with no covers, so the page falls back to its plate", () => {
    expect(pickInstitutionHero([resident("a")], [], curated)).toBeNull();
  });
});
