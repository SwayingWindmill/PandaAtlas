import { describe, expect, it } from "vitest";

import { areaChips, areaOf } from "./areas";

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
