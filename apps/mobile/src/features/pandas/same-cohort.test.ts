import { describe, expect, it } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { sameCohortPandas } from "./same-cohort";

function item(id: string, slug: string, name: string, birthDate: string | null, opts: { cover?: boolean; deceased?: boolean } = {}): PandaListItem {
  return {
    id,
    slug,
    name,
    sex: "female",
    birthDate,
    deceased: opts.deceased ?? false,
    place: null,
    placeId: null,
    area: null,
    hasFullBleedCover: opts.cover ?? false,
    terms: [],
    initials: [],
  };
}

describe("sameCohortPandas", () => {
  it("picks living same-year peers prioritizing covers and close birth months", () => {
    const index = [
      item("1", "fu-bao", "福宝", "2020-07-20", { cover: true }),
      item("2", "he-hua", "和花", "2020-07-04", { cover: true }),
      item("3", "no-cover-same-month", "无图七月", "2020-07-11", { cover: false }),
      item("4", "he-feng", "和风", "2020-08-09", { cover: true }),
      item("5", "gone", "已逝同年", "2020-07-02", { cover: true, deceased: true }),
      item("6", "other-year", "他年", "2019-07-06", { cover: true }),
    ];
    const res = sameCohortPandas({ id: "1", birthDate: "2020-07-20", deceased: false }, index, 4);
    expect(res).not.toBeNull();
    expect(res?.label).toBe("2020 年夏");
    expect(res?.items.map((entry) => [entry.panda.slug, entry.dateLabel])).toEqual([
      ["he-hua", "7月4日"],
      ["he-feng", "8月生"],
      ["no-cover-same-month", "7月11日"],
    ]);
  });

  it("returns null for deceased or undated pandas or empty cohorts", () => {
    const index = [item("2", "he-hua", "和花", "2020-07-04", { cover: true })];
    expect(sameCohortPandas({ id: "1", birthDate: "2020-07-20", deceased: true }, index)).toBeNull();
    expect(sameCohortPandas({ id: "1", birthDate: null, deceased: false }, index)).toBeNull();
    expect(sameCohortPandas({ id: "1", birthDate: "2015-07-04", deceased: false }, index)).toBeNull();
  });
});
