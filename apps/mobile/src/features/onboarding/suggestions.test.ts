import { describe, expect, it } from "vitest";

import { fameSlugs, suggestions, wellKnownPandas } from "./suggestions";

const panda = (id: string, birthDate: string | null, place: string | null, deceased = false) => ({
  id,
  slug: id,
  name: id,
  sex: null,
  birthDate,
  deceased,
  place,
  placeId: null,
  area: null,
  hasFullBleedCover: false,
  terms: [],
  initials: [],
});

describe("suggestions", () => {
  it("offers living pandas that can be visited, youngest first", () => {
    const pandas = [
      panda("old", "2005-08-01", "成都"),
      panda("cub", "2024-07-01", "卧龙"),
      panda("gone", "2023-01-01", "成都", true),
      panda("wild", "2022-01-01", null),
      panda("unknown", null, "上野"),
      panda("mid", "2016-09-01", "上野"),
    ];
    expect(suggestions(pandas, [], 3).map((item) => item.id)).toEqual(["cub", "mid", "old"]);
  });

  it("puts popular pandas first in rank order, then fills without duplicates", () => {
    const old = panda("old", "2005-08-01", "成都");
    const cub = panda("cub", "2024-07-01", "卧龙");
    const mid = panda("mid", "2016-09-01", "上野");
    const star = panda("star", "2010-01-01", "成都");
    expect(suggestions([old, cub, mid, star], [old, star], 4).map((item) => item.id)).toEqual([
      "old",
      "star",
      "cub",
      "mid",
    ]);
  });

  it("keeps the limit when popular pandas fill it", () => {
    const a = panda("a", "2005-08-01", "成都");
    const b = panda("b", "2024-07-01", "卧龙");
    const c = panda("c", "2016-09-01", "上野");
    expect(suggestions([a, b, c], [a, c], 1).map((item) => item.id)).toEqual(["a"]);
  });

  it("falls back to the youngest rule when popular is empty", () => {
    const pandas = [panda("old", "2005-08-01", "成都"), panda("cub", "2024-07-01", "卧龙")];
    expect(suggestions(pandas, []).map((item) => item.id)).toEqual(["cub", "old"]);
  });

  it("offers well-known pandas after the popular ones and before the youngest", () => {
    const cub = panda("cub", "2024-07-01", "卧龙");
    const famous = { ...panda("famous", "2020-01-01", null), slug: "meng-lan" };
    const trending = panda("trending", "2019-01-01", "成都");
    expect(suggestions([cub, famous, trending], [trending], 3).map((item) => item.id)).toEqual([
      "trending",
      "famous",
      "cub",
    ]);
  });

  it("orders fame by popular rank, then the well-known list", () => {
    const slugs = fameSlugs([{ ...panda("x", null, null), slug: "tian-tian" }, { ...panda("y", null, null), slug: "zz" }]);
    expect(slugs.slice(0, 3)).toEqual(["tian-tian", "zz", "he-hua-chengdu"]);
  });

  it("skips a well-known panda that has died or is not in the index", () => {
    const gone = { ...panda("gone", "2010-01-01", "成都", true), slug: "mei-xiang" };
    const here = { ...panda("here", "2020-01-01", null), slug: "fu-bao" };
    expect(wellKnownPandas([gone, here]).map((item) => item.id)).toEqual(["here"]);
    expect(suggestions([gone], [], 5)).toEqual([]);
  });

  it("does not repeat a well-known panda that is also popular or young", () => {
    const famous = { ...panda("famous", "2024-07-01", "成都"), slug: "he-hua-chengdu" };
    expect(suggestions([famous], [famous]).map((item) => item.id)).toEqual(["famous"]);
  });
});
