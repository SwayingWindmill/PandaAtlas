import { describe, expect, it } from "vitest";

import { WILD_AREAS, WILD_RANGES, WILD_SOURCE } from "./wild";

describe("wild areas", () => {
  it("adds up to the park total in Table 1", () => {
    const total = WILD_RANGES.flatMap((range) => range.populations).reduce((sum, population) => sum + population.count, 0);
    expect(total).toBe(WILD_SOURCE.parkTotal);
    const habitat = WILD_RANGES.flatMap((range) => range.populations).reduce((sum, population) => sum + population.habitatKm2, 0);
    expect(habitat).toBeCloseTo(15017.6, 1);
  });

  it("lists the 13 local populations", () => {
    expect(WILD_RANGES.flatMap((range) => range.populations)).toHaveLength(13);
  });

  it("places every population, with an area that grows with its habitat", () => {
    for (const area of WILD_AREAS) {
      for (const patch of area.patches) {
        expect(Number.isFinite(patch.x) && Number.isFinite(patch.y)).toBe(true);
        expect(patch.radius).toBeGreaterThan(0);
      }
    }
    const qionglai = WILD_AREAS.find((area) => area.range.id === "qionglai")!;
    expect(qionglai.patches[1]!.radius).toBeGreaterThan(qionglai.patches[0]!.radius);
  });

  it("names the provinces a range crosses", () => {
    expect(WILD_AREAS.find((area) => area.range.id === "qinling")!.provinces.sort()).toEqual(["四川", "甘肃", "陕西"].sort());
  });
});
