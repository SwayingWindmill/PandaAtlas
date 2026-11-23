import { describe, expect, it } from "vitest";

import type { MapItem } from "./model";
import { filterMapItems, mapFilterCounts, resolveLiveCamMap, venueLiveMeta } from "./map-filter";
import { WILD_AREAS } from "./wild";

function makeItem(overrides: Partial<MapItem> & Pick<MapItem, "id" | "slug" | "name">): MapItem {
  return {
    kind: "institution",
    where: "中国",
    overseas: false,
    residentCount: 5,
    residentNames: null,
    residents: [],
    point: { x: 100, y: 100 },
    placeIds: [],
    coordinates: null,
    ...overrides,
  };
}

describe("map-filter", () => {
  const items: MapItem[] = [
    makeItem({ id: "i:cd", slug: "chengdu-research-base", name: "成都基地", overseas: false }),
    makeItem({ id: "i:bj", slug: "beijing-zoo", name: "北京动物园", overseas: false }),
    makeItem({ id: "i:dc", slug: "smithsonian-national-zoo", name: "史密森国家动物园", overseas: true, where: "美国" }),
    makeItem({ id: "p:unlinked", kind: "place", slug: "unlinked-place", name: "某地点", overseas: true, where: "日本" }),
  ];
  const cams = resolveLiveCamMap([{ slug: "chengdu-research-base", liveCamUrl: "https://example.org/cam" }]);

  it("filters domestic, overseas, live, and wild views", () => {
    expect(filterMapItems(items, "all", cams)).toHaveLength(4);
    expect(filterMapItems(items, "china", cams).map((i) => i.slug)).toEqual(["chengdu-research-base", "beijing-zoo"]);
    expect(filterMapItems(items, "overseas", cams).map((i) => i.slug)).toEqual(["smithsonian-national-zoo", "unlinked-place"]);
    expect(filterMapItems(items, "live", cams).map((i) => i.slug)).toEqual(["chengdu-research-base", "smithsonian-national-zoo"]);
    expect(filterMapItems(items, "wild", cams)).toEqual([]);
  });

  it("computes counts for each filter pill", () => {
    expect(mapFilterCounts(items, cams)).toEqual({
      all: 4,
      china: 2,
      overseas: 2,
      live: 2,
      wild: WILD_AREAS.length,
    });
  });

  it("resolves live metadata cleanly when an institution has a known spec", () => {
    const meta = venueLiveMeta(items[0]!, cams, new Date("2026-11-24T02:25:00Z"));
    expect(meta).toEqual({
      liveCamUrl: "https://example.org/cam",
      localTime: "10:25",
      status: "active",
      statusLabel: "活跃中",
    });
  });

  it("returns null metadata when an item has neither spec nor API cam URL", () => {
    const plain = makeItem({ id: "i:fx", slug: "fixture-zoo", name: "测试园", overseas: true });
    expect(venueLiveMeta(plain, cams)).toBeNull();
  });
});
