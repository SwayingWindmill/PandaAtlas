import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { hasBurnedInMark, hasCuratedCover, isCuratedCover, pickStoryPhotos, storyCandidates } from "./story-order";

const panda = (id: string, deceased = false): PandaListItem => ({
  id,
  slug: id,
  name: id,
  sex: null,
  birthDate: null,
  deceased,
  place: null,
  placeId: null,
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
    const picks = pickStoryPhotos(
      ["a", "b", "c", "d", "e"].map((id) => panda(id)),
      covers,
      3,
    );
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

describe("curated covers", () => {
  const curated = new Map([["a", "0123456789abcdef"]]);

  it("accepts only the reviewed photo of a reviewed panda", () => {
    expect(hasCuratedCover("a", curated)).toBe(true);
    expect(hasCuratedCover("b", curated)).toBe(false);
    expect(isCuratedCover({ pandaId: "a", contentSha256: `0123456789abcdef${"0".repeat(48)}` }, curated)).toBe(true);
  });

  it("drops a panda whose cover was replaced after the review", () => {
    expect(isCuratedCover({ pandaId: "a", contentSha256: "f".repeat(64) }, curated)).toBe(false);
  });

  it("leaves out the reported thumbnail and colour-cast covers", () => {
    // 雪雪's 152×180 thumbnail with her name and a grey frame; 桃苏's blue-cast photo.
    expect(hasCuratedCover("d3ca0021-b582-53b1-a6c1-8d89354131cf")).toBe(false);
    expect(hasCuratedCover("d90aafd8-7759-58b0-8216-7e5c272b01cc")).toBe(false);
  });
});
