import { describe, expect, it } from "vitest";

import { suggestions } from "./suggestions";

const panda = (id: string, birthDate: string | null, place: string | null, deceased = false) => ({
  id,
  slug: id,
  name: id,
  sex: null,
  birthDate,
  deceased,
  place,
  area: null,
  terms: [],
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
    expect(suggestions(pandas, 3).map((item) => item.id)).toEqual(["cub", "mid", "old"]);
  });
});
