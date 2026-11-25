import { describe, expect, it } from "vitest";

import type { MapItem } from "@/features/map/model";

import { buildLiveHallModel } from "./live-hall";

function mapVenue(
  slug: string,
  name: string,
  options: { residentCount?: number; overseas?: boolean; where?: string | null } = {},
): MapItem {
  const residentCount = options.residentCount ?? 2;
  return {
    id: `institution:${slug}`,
    kind: "institution",
    slug,
    name,
    where: options.where ?? (options.overseas === false ? "中国" : "美国"),
    overseas: options.overseas ?? slug !== "chengdu-research-base",
    residentCount,
    residentNames: null,
    residents:
      residentCount > 0
        ? [{ id: `p-${slug}`, slug: `p-${slug}`, name: "代表熊猫", hasFullBleedCover: true }]
        : [],
    point: null,
    placeIds: [],
    coordinates: null,
  };
}

describe("buildLiveHallModel", () => {
  // 2026-11-25 01:30 UTC -> 09:30 CST (active in China), 02:30 CET (closed in Vienna), 20:30 EST prev day (closed in DC)
  const chinaMorningUtc = new Date("2026-11-25T01:30:00Z");

  it("builds accurate regional daytime/nighttime pulses and partitions awake vs resting venues", () => {
    const model = buildLiveHallModel(
      [
        mapVenue("chengdu-research-base", "成都大熊猫繁育研究基地", { residentCount: 20, overseas: false, where: "中国" }),
        mapVenue("tiergarten-schonbrunn", "美泉宫动物园", { residentCount: 2, overseas: true, where: "奥地利" }),
        mapVenue("smithsonian-national-zoo", "史密森国家动物园", { residentCount: 2, overseas: true, where: "美国" }),
      ],
      [],
      "all",
      chinaMorningUtc,
    );

    const asia = model.pulses.find((p) => p.key === "eastAsia");
    const europe = model.pulses.find((p) => p.key === "europe");
    const america = model.pulses.find((p) => p.key === "northAmerica");

    expect(asia).toMatchObject({ isDaytime: true, activeCount: 1 });
    expect(europe).toMatchObject({ isDaytime: false, activeCount: 0 });
    expect(america).toMatchObject({ isDaytime: false, activeCount: 0 });

    expect(model.summary).toEqual({
      totalCount: 3,
      activeCount: 1,
      liveCount: 2,
      restingCount: 2,
      overseasCount: 2,
    });
    expect(model.awake.map((v) => v.slug)).toEqual(["chengdu-research-base"]);
    expect(model.resting.map((v) => v.slug)).toEqual([
      "tiergarten-schonbrunn",
      "smithsonian-national-zoo",
    ]);
  });

  it("excludes zero-resident no-cam venues and respects live/active/overseas filters", () => {
    const sample = [
      mapVenue("chengdu-research-base", "成都大熊猫繁育研究基地", { residentCount: 20, overseas: false }),
      mapVenue("ueno-zoo", "上野动物园", { residentCount: 0, overseas: true, where: "日本" }),
      mapVenue("zooparc-de-beauval", "博瓦勒野生动物园", { residentCount: 4, overseas: true, where: "法国" }),
    ];

    const allModel = buildLiveHallModel(sample, [], "all", chinaMorningUtc);
    expect(allModel.summary.totalCount).toBe(2);
    expect(allModel.awake.some((v) => v.slug === "ueno-zoo")).toBe(false);
    expect(allModel.resting.some((v) => v.slug === "ueno-zoo")).toBe(false);

    const overseasModel = buildLiveHallModel(sample, [], "overseas", chinaMorningUtc);
    expect([...overseasModel.awake, ...overseasModel.resting].map((v) => v.slug)).toEqual(["zooparc-de-beauval"]);

    const activeModel = buildLiveHallModel(sample, [], "active", chinaMorningUtc);
    expect(activeModel.awake.map((v) => v.slug)).toEqual(["chengdu-research-base"]);
    expect(activeModel.resting).toEqual([]);

    const liveWithApiCam = buildLiveHallModel(
      sample,
      [{ slug: "zooparc-de-beauval", liveCamUrl: "https://example.test/beauval" }],
      "live",
      chinaMorningUtc,
    );
    expect([...liveWithApiCam.awake, ...liveWithApiCam.resting].map((v) => v.slug)).toEqual([
      "chengdu-research-base",
      "zooparc-de-beauval",
    ]);
  });

  it("keeps active filter results aligned with summary.activeCount when upcoming venues exist", () => {
    // 14:15 UTC -> 06:15 PST (san-diego-zoo is upcoming), 09:15 EST (smithsonian is active)
    const usMorning = new Date("2026-11-23T14:15:00Z");
    const activeFiltered = buildLiveHallModel(
      [
        mapVenue("smithsonian-national-zoo", "史密森国家动物园"),
        mapVenue("san-diego-zoo", "圣地亚哥动物园"),
      ],
      [],
      "active",
      usMorning,
    );
    expect(activeFiltered.summary.activeCount).toBe(1);
    expect(activeFiltered.awake.map((v) => v.slug)).toEqual(["smithsonian-national-zoo"]);
  });
});
