import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { hasBurnedInMark, pickStoryPhotos, storyCandidates } from "./story-order";

const panda = (id: string, deceased = false): PandaListItem => ({
  id,
  slug: id,
  name: id,
  sex: null,
  birthDate: null,
  deceased,
  place: null,
  area: null,
  terms: [id],
});

describe("storyCandidates", () => {
  const pandas = ["a", "b", "c", "d", "e", "f"].map((id) => panda(id));

  it("keeps the same order for the same day, whatever order the list came in", () => {
    const first = storyCandidates(pandas, "2026-10-29").map((item) => item.id);
    const again = storyCandidates([...pandas].reverse(), "2026-10-29").map((item) => item.id);
    expect(again).toEqual(first);
  });

  it("leaves out pandas that have died", () => {
    const ids = storyCandidates([...pandas, panda("gone", true)], "2026-10-29").map((item) => item.id);
    expect(ids).not.toContain("gone");
    expect(ids).toHaveLength(6);
  });
});

describe("pickStoryPhotos", () => {
  it("gives every card a different photo and skips pandas without one", () => {
    const covers = new Map([
      ["a", "https://media/1.webp"],
      ["b", "https://media/1.webp"],
      ["d", "https://media/2.webp"],
      ["e", "https://media/3.webp"],
    ]);
    const picks = pickStoryPhotos(["a", "b", "c", "d", "e"].map((id) => panda(id)), covers, 3);
    expect(picks.map((pick) => pick.pandaId)).toEqual(["a", "d", "e"]);
    expect(new Set(picks.map((pick) => pick.url)).size).toBe(3);
  });
});

describe("hasBurnedInMark", () => {
  it("flags covers credited to Xinhua, in English or Chinese", () => {
    expect(hasBurnedInMark({ creator: "Xinhua via People's Daily Online", attributionText: null })).toBe(true);
    expect(hasBurnedInMark({ creator: null, attributionText: "照片 新华社" })).toBe(true);
  });

  it("flags Pandapia's logo-stamped crops", () => {
    expect(hasBurnedInMark({ creator: "Pandapia", attributionText: "Pandapia" })).toBe(true);
  });

  it("keeps other credits and covers without one", () => {
    expect(hasBurnedInMark({ creator: "Smithsonian's National Zoo", attributionText: "CC BY 4.0" })).toBe(false);
    expect(hasBurnedInMark({})).toBe(false);
  });
});
