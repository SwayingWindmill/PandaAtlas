import { describe, expect, it } from "vitest";

import { NOT_RECORDED, QUIET_DASH, UNKNOWN, ageAt, headlineStats, infobox, placesLived, unifiedMetrics } from "./profile-facts";

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
  const living = {
    birthDate: "2021-08-04",
    deceased: false,
    deathDate: null,
    place: { short: "卧龙", sub: "神树坪基地" },
  };

  it("leads with the birthday, the age and where it lives", () => {
    expect(headlineStats({ ...living, today: "2026-10-29" })).toEqual([
      { key: "birth", label: "生日", value: "8.4" },
      { key: "age", label: "年龄", value: "5", unit: "岁" },
      { key: "place", label: "所在地", value: "卧龙", detail: "神树坪基地" },
    ]);
  });

  it("counts a cub under a year in months", () => {
    const [, age] = headlineStats({ ...living, birthDate: "2026-03-30", today: "2026-10-29" });
    expect(age).toMatchObject({ value: "6", unit: "个月" });
  });

  it("keeps a birthday as precise as the record", () => {
    expect(headlineStats({ ...living, birthDate: "2021-08", today: "2026-10-29" })[0]).toMatchObject({ value: "8", unit: "月" });
    expect(headlineStats({ ...living, birthDate: "2021", today: "2026-10-29" })[0]).toMatchObject({ value: "2021", unit: "年" });
  });

  it("gives the age at death and the year it died once it has", () => {
    expect(
      headlineStats({ ...living, deceased: true, birthDate: "1986-09-04", deathDate: "2016-10-16", place: null, today: "2026-10-29" }),
    ).toEqual([
      { key: "birth", label: "生日", value: "9.4" },
      { key: "age", label: "享年", value: "30", unit: "岁" },
      { key: "place", label: "离世", value: "2016", unit: "年" },
    ]);
  });

  it("says what is not recorded in words short enough for a tile", () => {
    const stats = headlineStats({ birthDate: null, deceased: false, deathDate: null, place: null, today: "2026-10-29" });
    expect(stats.map((stat) => stat.value)).toEqual([NOT_RECORDED, NOT_RECORDED, NOT_RECORDED]);
    expect(stats.every((stat) => !stat.unit && !stat.detail)).toBe(true);
  });
});

describe("unifiedMetrics (v3.7 top 3-column strip)", () => {
  it("keeps 生日 | 现居 | 谱系号 aligned across star and sparse pandas with quiet dashes", () => {
    expect(
      unifiedMetrics({
        birthDate: "2020-07-20",
        birthConfirmed: true,
        deceased: false,
        deathDate: null,
        place: { short: "卧龙", sub: "神树坪基地" },
        hasInstitution: true,
        studbookNumber: null,
        today: "2026-11-24",
      }),
    ).toEqual([
      {
        key: "birth",
        label: "生日",
        value: "7月20日",
        sub: "2020 年　6 岁",
        muted: false,
        link: false,
        spoken: "生日，7月20日，2020 年 6 岁，已确认",
      },
      {
        key: "place",
        label: "现居",
        value: "卧龙",
        sub: "神树坪基地",
        muted: false,
        link: true,
        spoken: "现居，卧龙，神树坪基地",
      },
      {
        key: "studbook",
        label: "谱系号",
        value: QUIET_DASH,
        sub: "国际谱系",
        muted: true,
        link: false,
        spoken: "谱系号，未记录",
      },
    ]);

    const baoMei = unifiedMetrics({
      birthDate: "2019-07-06",
      birthConfirmed: false,
      deceased: false,
      deathDate: null,
      place: null,
      hasInstitution: false,
      studbookNumber: "#1186",
      today: "2026-11-24",
    });
    expect(baoMei[1]).toMatchObject({ label: "现居", value: QUIET_DASH, sub: "暂未收录", muted: true, link: false });
    expect(baoMei[2]).toMatchObject({ label: "谱系号", value: "#1186", sub: "国际谱系", muted: false, link: true });
  });

  it("formats deceased memorial metrics cleanly", () => {
    const memorial = unifiedMetrics({
      birthDate: "1986-09-04",
      birthConfirmed: true,
      deceased: true,
      deathDate: "2016-10-16",
      place: null,
      hasInstitution: false,
      studbookNumber: "#314",
      today: "2026-11-24",
    });
    expect(memorial[0]).toMatchObject({ label: "生日", value: "9月4日", sub: "1986 年生" });
    expect(memorial[1]).toMatchObject({ label: "离世", value: "2016 年", sub: "享年 30 岁", link: false });
    expect(memorial[2]).toMatchObject({ label: "谱系号", value: "#314", link: true });
  });
});
