import { describe, expect, it } from "vitest";

import { NOT_RECORDED, UNKNOWN, ageAt, headlineStats, infobox, placesLived } from "./profile-facts";

const longDate = (value: string) => `[${value}]`;

describe("infobox", () => {
  it("states sex, birth, birthplace, home and parents in that order", () => {
    expect(
      infobox({
        sex: "female",
        birthDate: "2020-07-20",
        birthPlace: "爱宝乐园",
        deceased: false,
        deathDate: null,
        currentPlace: "卧龙神树坪基地",
        parents: ["乐宝", "爱宝"],
        longDate,
      }),
    ).toEqual([
      { label: "性别", value: "雌" },
      { label: "出生", value: "[2020-07-20]" },
      { label: "出生地", value: "爱宝乐园" },
      { label: "所在地", value: "卧龙神树坪基地" },
      { label: "父母", value: "乐宝　爱宝" },
    ]);
  });

  it("says what is unknown instead of hiding it, and gives the age at death", () => {
    expect(
      infobox({
        sex: null,
        birthDate: null,
        birthPlace: null,
        deceased: false,
        deathDate: null,
        currentPlace: null,
        parents: [],
        longDate,
      }).map((fact) => fact.value),
    ).toEqual([UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]);
    const memorial = infobox({
      sex: "female",
      birthDate: "1978",
      birthPlace: null,
      deceased: true,
      deathDate: "2016-10-16",
      currentPlace: null,
      parents: [],
      longDate,
    });
    expect(memorial.map((fact) => fact.label)).toEqual(["性别", "出生", "离世", "享年", "父母"]);
    expect(memorial[3]).toEqual({ label: "享年", value: "38 岁" });
  });
});

describe("ageAt", () => {
  it("counts full years when both days are known", () => {
    expect(ageAt("2020-07-20", "2026-07-19")).toBe(5);
    expect(ageAt("2020-07-20", "2026-07-20")).toBe(6);
    expect(ageAt("1978", "2016-10-16")).toBe(38);
  });
});

describe("placesLived", () => {
  it("lists homes newest first with their years and marks the open one", () => {
    const names: Record<string, string> = { atlanta: "亚特兰大动物园", chengdu: "成都基地" };
    expect(
      placesLived(
        [
          { placeId: "atlanta", startOn: "2016-09-03", endOn: "2024-10-12" },
          { placeId: "chengdu", startOn: "2024-10-13" },
          { placeId: "unpublished", startOn: "2010-01-01" },
        ],
        (id) => names[id] ?? null,
      ),
    ).toEqual([
      { place: "成都基地", years: "2024 至今", current: true },
      { place: "亚特兰大动物园", years: "2016–2024", current: false },
    ]);
  });
});

describe("headlineStats", () => {
  const living = { sex: "male" as const, birthDate: "2021-08-04", deceased: false, deathDate: null, currentPlace: "史密森国家动物园" };

  it("leads with sex, age and where it lives", () => {
    expect(headlineStats({ ...living, today: "2026-10-29" })).toEqual([
      { key: "sex", label: "性别", value: "雄" },
      { key: "age", label: "年龄", value: "5 岁", detail: "2021 年出生" },
      { key: "place", label: "所在地", value: "史密森国家动物园" },
    ]);
  });

  it("counts a cub under a year in months", () => {
    expect(headlineStats({ ...living, birthDate: "2026-03-30", today: "2026-10-29" })[1]?.value).toBe("6 个月");
  });

  it("gives the age at death and the year it died once it has", () => {
    expect(
      headlineStats({ ...living, deceased: true, birthDate: "1986-09-04", deathDate: "2016-10-16", currentPlace: null, today: "2026-10-29" }),
    ).toEqual([
      { key: "sex", label: "性别", value: "雄" },
      { key: "age", label: "享年", value: "30 岁", detail: "1986 年出生" },
      { key: "place", label: "离世", value: "2016 年" },
    ]);
  });

  it("says what is not recorded in words short enough for a tile", () => {
    const stats = headlineStats({ sex: null, birthDate: null, deceased: false, deathDate: null, currentPlace: null, today: "2026-10-29" });
    expect(stats.map((stat) => stat.value)).toEqual([NOT_RECORDED, NOT_RECORDED, NOT_RECORDED]);
    expect(stats[1]?.detail).toBeUndefined();
  });
});
