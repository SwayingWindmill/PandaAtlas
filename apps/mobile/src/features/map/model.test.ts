import { describe, expect, it } from "vitest";
import { projectToWorld } from "@zhipanda/world-map";

import {
  type MapInstitutionInput,
  type MapPandaInput,
  type MapPlaceInput,
  type MapResidencyInput,
  buildMapView,
  buildPlacePage,
  mapDotLabel,
  mapItemLabel,
} from "./model";

const chengdu = { longitude: 104.1456, latitude: 30.733 };
const yaan = { longitude: 102.9762, latitude: 30.072 };
const beijing = { longitude: 116.3394, latitude: 39.9375 };

function institution(overrides: Partial<MapInstitutionInput> = {}): MapInstitutionInput {
  return { institutionId: "inst-1", slug: "chengdu-base", nameZh: "成都基地", countryCode: "CN", ...overrides };
}

function place(overrides: Partial<MapPlaceInput> = {}): MapPlaceInput {
  return {
    placeId: "place-1",
    institutionId: "inst-1",
    slug: "chengdu-facility",
    placeType: "facility",
    nameZh: "成都熊猫馆",
    countryCode: "CN",
    ...chengdu,
    ...overrides,
  };
}

function panda(id: string, name: string): MapPandaInput {
  return { id, slug: id, name };
}

function residency(pandaId: string, placeId: string, startOn: string, endOn?: string): MapResidencyInput {
  return { pandaId, placeId, startOn, endOn };
}

describe("buildMapView", () => {
  it("projects a place's coordinates and keeps a place with none in the list only", () => {
    const view = buildMapView(
      [institution(), institution({ institutionId: "inst-2", slug: "no-pin", nameZh: "还没坐标" })],
      [place(), place({ placeId: "place-2", institutionId: "inst-2", slug: "no-pin-facility", longitude: undefined, latitude: undefined })],
      [],
      [],
    );

    const pinned = view.items.find((item) => item.slug === "chengdu-base");
    const unpinned = view.items.find((item) => item.slug === "no-pin");
    expect(pinned?.point).toEqual(projectToWorld(chengdu.longitude, chengdu.latitude));
    expect(pinned?.point?.x).toBeGreaterThan(750);
    expect(unpinned?.point).toBeNull();
    expect(view.clusters).toHaveLength(1);
    expect(view.clusters[0]?.items.map((item) => item.slug)).toEqual(["chengdu-base"]);
    expect(view.groups.map((group) => group.title)).toEqual(["中国"]);
  });

  it("folds an institution's places into one row and lists a place that belongs to none", () => {
    const view = buildMapView(
      [institution()],
      [
        place(),
        place({ placeId: "place-2", slug: "second-hall", longitude: undefined, latitude: undefined }),
        place({
          placeId: "ueno",
          institutionId: undefined,
          slug: "ueno-zoo",
          nameZh: "上野动物园",
          countryCode: "JP",
          longitude: 139.7714,
          latitude: 35.7163,
        }),
        place({ placeId: "coarse", institutionId: undefined, slug: "somewhere", placeType: "coarse_location", nameZh: "某地" }),
      ],
      [residency("bao", "place-1", "2020-01-01"), residency("lan", "place-2", "2021-06-01"), residency("bao", "ueno", "2019-01-01", "2020-01-01")],
      [panda("bao", "宝"), panda("lan", "兰")],
    );

    expect(view.items.map((item) => item.slug)).toEqual(["chengdu-base", "ueno-zoo"]);
    const base = view.items[0];
    expect(base?.kind).toBe("institution");
    expect(base?.residentCount).toBe(2);
    expect(base?.residentNames).toBe("宝、兰");
    expect(view.items[1]).toMatchObject({ kind: "place", overseas: true, where: "日本", residentCount: 0 });
    expect(view.groups.map((group) => group.id)).toEqual(["china", "overseas"]);
    expect(mapItemLabel(view.items[1]!)).toBe("上野动物园，日本，现在没有熊猫");
  });

  it("draws nearby bases as one dot and leaves a distant base on its own", () => {
    const view = buildMapView(
      [
        institution({ institutionId: "cd", slug: "chengdu", nameZh: "成都" }),
        institution({ institutionId: "ya", slug: "yaan", nameZh: "雅安" }),
        institution({ institutionId: "bj", slug: "beijing", nameZh: "北京" }),
      ],
      [
        place({ placeId: "cd", institutionId: "cd", ...chengdu }),
        place({ placeId: "ya", institutionId: "ya", ...yaan }),
        place({ placeId: "bj", institutionId: "bj", ...beijing }),
      ],
      [residency("a", "cd", "2010-01-01"), residency("b", "cd", "2011-01-01"), residency("c", "ya", "2012-01-01")],
      [panda("a", "甲"), panda("b", "乙"), panda("c", "丙")],
    );

    expect(view.clusters).toHaveLength(2);
    const sichuan = view.clusters.find((cluster) => cluster.items.length === 2);
    expect(sichuan?.items.map((item) => item.slug)).toEqual(["chengdu", "yaan"]);
    expect(sichuan && mapDotLabel(sichuan)).toBe("成都、雅安，2 个地方");
    expect(view.clusters.find((cluster) => cluster.items.length === 1)?.items[0]?.slug).toBe("beijing");
  });

  it("names the first three residents and counts the rest", () => {
    const view = buildMapView(
      [institution()],
      [place()],
      ["甲", "乙", "丙", "丁"].map((name, index) => residency(name, "place-1", `202${index}-01-01`)),
      ["甲", "乙", "丙", "丁"].map((name) => panda(name, name)),
    );
    expect(view.items[0]?.residentNames).toBe("甲、乙、丙 等 4 只");
  });

  it("is empty when nothing is published", () => {
    expect(buildMapView([], [], [], [])).toEqual({ items: [], clusters: [], groups: [] });
  });
});

describe("buildPlacePage", () => {
  it("names the place, its institution and the pandas living there now", () => {
    const page = buildPlacePage(
      "hall",
      [place({ slug: "hall", nameZh: "熊猫馆" })],
      [institution({ nameZh: "成都基地" })],
      [residency("bao", "place-1", "2020-01-01"), residency("lan", "place-1", "2019-01-01", "2020-01-01")],
      [panda("bao", "宝"), panda("lan", "兰")],
    );
    expect(page).toEqual({
      name: "熊猫馆",
      where: "中国",
      institution: { slug: "chengdu-base", name: "成都基地" },
      residents: [panda("bao", "宝")],
    });
  });

  it("opens the surviving place for a merged duplicate's old slug", () => {
    const page = buildPlacePage(
      "ccrcgp-yaan-base",
      [place({ slug: "ccrcgp-bifengxia-base", nameZh: "碧峰峡基地", legacySlugs: ["ccrcgp-yaan-base"] })],
      [institution()],
      [residency("bao", "place-1", "2020-01-01")],
      [panda("bao", "宝")],
    );
    expect(page?.name).toBe("碧峰峡基地");
    expect(page?.residents).toEqual([panda("bao", "宝")]);
  });

  it("returns nothing for an unknown slug", () => {
    expect(buildPlacePage("missing", [], [], [], [])).toBeNull();
  });
});
