import { describe, expect, it } from "vitest";

import { areaChips, areaOf, shortPlace } from "./areas";

const facility = (countryCode: string, region: string) =>
  ({ placeId: "p", slug: "p", placeType: "facility", countryCode, region }) as Parameters<typeof areaOf>[0];

describe("areaOf", () => {
  it("names Chinese base areas and groups the rest of the world as 海外", () => {
    expect(areaOf(facility("CN", "Wolong, Sichuan"))).toBe("卧龙");
    expect(areaOf(facility("CN", "Ya'an, Sichuan"))).toBe("雅安");
    expect(areaOf(facility("JP", "Tokyo"))).toBe("海外");
    expect(areaOf(facility("CN", "Somewhere, Shaanxi"))).toBeNull();
    expect(areaOf(undefined)).toBeNull();
  });
});

describe("areaChips", () => {
  it("offers only areas some panda lives in, 海外 last", () => {
    expect(areaChips([{ area: "海外" }, { area: "成都" }, { area: null }, { area: "卧龙" }])).toEqual([
      "卧龙",
      "成都",
      "海外",
    ]);
  });
});

describe("shortPlace", () => {
  const named = (countryCode: string, region: string, nameZh: string) =>
    ({ ...facility(countryCode, region), nameZh }) as Parameters<typeof shortPlace>[0];

  it("names a base by its area, with the rest of its name under it", () => {
    expect(shortPlace(named("CN", "Wolong, Sichuan", "中国大熊猫保护研究中心卧龙神树坪基地"))).toEqual({ short: "卧龙", sub: "神树坪基地" });
    expect(shortPlace(named("CN", "Ya'an, Sichuan", "雅安碧峰峡基地"))).toEqual({ short: "雅安", sub: "碧峰峡基地" });
  });

  it("names a zoo abroad by its city, and keeps a name it cannot shorten", () => {
    expect(shortPlace(named("US", "Washington, D.C.", "史密森国家动物园"))).toEqual({ short: "华盛顿", sub: "史密森国家动物园" });
    expect(shortPlace(named("KR", "Yongin", "爱宝乐园"))).toEqual({ short: "爱宝乐园", sub: null });
    expect(shortPlace(undefined)).toBeNull();
  });
});
