import { describe, expect, it } from "vitest";

import { heroCandidates, pickInstitutionHero } from "./hero-pick";

const resident = (id: string, hasFullBleedCover = true) => ({ id, name: id, hasFullBleedCover });
const cover = (pandaId: string, fullBleedReady = true) => ({ pandaId, fullBleedReady });

describe("heroCandidates", () => {
  it("keeps only residents with a full-bleed cover flag, in page order", () => {
    expect(heroCandidates([resident("x", false), resident("b"), resident("a")]).map((panda) => panda.id)).toEqual([
      "b",
      "a",
    ]);
  });
});

describe("pickInstitutionHero", () => {
  it("takes the first resident whose cover is ready for full-bleed use", () => {
    const pick = pickInstitutionHero([resident("a"), resident("b")], [cover("b"), cover("a")]);
    expect(pick?.panda.id).toBe("a");
  });

  it("skips a resident whose cover is not full-bleed ready", () => {
    const pick = pickInstitutionHero([resident("a"), resident("b")], [cover("a", false), cover("b", true)]);
    expect(pick?.panda.id).toBe("b");
  });

  it("returns null when no cover qualifies", () => {
    expect(pickInstitutionHero([resident("a")], [cover("a", false)])).toBeNull();
  });

  it("returns null with no covers, so the page falls back to its plate", () => {
    expect(pickInstitutionHero([resident("a")], [])).toBeNull();
  });
});
