import { describe, expect, it } from "vitest";

import type { MapItem } from "./model";
import {
  countVisitedThisYear,
  filterMapItems,
  lastVisitedOfItem,
  mapFilterCounts,
  resolveLiveCamMap,
  resolveVisitedInstitutions,
  venueLiveMeta,
} from "./map-filter";
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
    makeItem({ id: "institution:cd", slug: "chengdu-research-base", name: "成都基地", overseas: false, placeIds: ["p-cd-1", "p-cd-2"] }),
    makeItem({ id: "institution:bj", slug: "beijing-zoo", name: "北京动物园", overseas: false, placeIds: ["p-bj"] }),
    makeItem({ id: "institution:dc", slug: "smithsonian-national-zoo", name: "史密森国家动物园", overseas: true, where: "美国", placeIds: ["p-dc"] }),
    makeItem({ id: "place:unlinked", kind: "place", slug: "unlinked-place", name: "某地点", overseas: true, where: "日本", placeIds: ["p-unlinked"] }),
  ];
  const cams = resolveLiveCamMap([{ slug: "chengdu-research-base", liveCamUrl: "https://example.org/cam" }]);

  it("filters domestic, overseas, live, visited, and wild views", () => {
    const visited = new Set(["cd"]);
    const visitedPlaces = new Set(["p-unlinked"]);

    expect(filterMapItems(items, "all", cams, visited, visitedPlaces)).toHaveLength(4);
    expect(filterMapItems(items, "visited", cams, visited, visitedPlaces).map((i) => i.slug)).toEqual([
      "chengdu-research-base",
      "unlinked-place",
    ]);
    expect(filterMapItems(items, "china", cams).map((i) => i.slug)).toEqual(["chengdu-research-base", "beijing-zoo"]);
    expect(filterMapItems(items, "overseas", cams).map((i) => i.slug)).toEqual(["smithsonian-national-zoo", "unlinked-place"]);
    expect(filterMapItems(items, "live", cams).map((i) => i.slug)).toEqual(["chengdu-research-base", "smithsonian-national-zoo"]);
    expect(filterMapItems(items, "wild", cams)).toEqual([]);
  });

  it("computes counts for each filter pill including visited", () => {
    expect(mapFilterCounts(items, cams)).toEqual({
      all: 4,
      visited: 0,
      china: 2,
      overseas: 2,
      live: 2,
      wild: WILD_AREAS.length,
    });

    const visited = new Set(["institution:bj", "dc"]);
    expect(mapFilterCounts(items, cams, visited)).toEqual({
      all: 4,
      visited: 2,
      china: 2,
      overseas: 2,
      live: 2,
      wild: WILD_AREAS.length,
    });
  });

  it("resolves visited institutions, latest and earliest dates across places", () => {
    const places = new Map([
      ["p-cd-1", { placeId: "p-cd-1", institutionId: "cd" }],
      ["p-cd-2", { placeId: "p-cd-2", institutionId: "cd" }],
      ["p-bj", { placeId: "p-bj", institutionId: "bj" }],
      ["p-unlinked", { placeId: "p-unlinked" }],
    ]);
    const summary = resolveVisitedInstitutions(
      [
        { placeId: "p-cd-1", visitedOn: "2024-05-01" },
        { placeId: "p-cd-2", visitedOn: "2026-11-25" },
        { placeId: "p-bj", visitedOn: "2026-10-14" },
        { placeId: "p-unlinked", visitedOn: "2025-03-02" },
      ],
      places,
    );

    expect([...summary.visitedInstitutionIds].sort()).toEqual(["bj", "cd"]);
    expect(summary.lastVisitedByInstitution.get("cd")).toBe("2026-11-25");
    expect(summary.firstVisitedByInstitution.get("cd")).toBe("2024-05-01");
    expect(summary.lastVisitedByInstitution.get("bj")).toBe("2026-10-14");
    expect(summary.visitedPlaceIds.has("p-unlinked")).toBe(true);

    expect(filterMapItems(items, "visited", cams, summary.visitedInstitutionIds, summary.visitedPlaceIds).map((i) => i.slug)).toEqual([
      "chengdu-research-base",
      "beijing-zoo",
      "unlinked-place",
    ]);
    expect(lastVisitedOfItem(items[0]!, summary.lastVisitedByInstitution, summary.lastVisitedByPlace)).toBe("2026-11-25");
    expect(lastVisitedOfItem(items[3]!, summary.lastVisitedByInstitution, summary.lastVisitedByPlace)).toBe("2025-03-02");
    expect(countVisitedThisYear(items, summary.firstVisitedByInstitution, summary.firstVisitedByPlace, 2026)).toBe(1);
    expect(countVisitedThisYear(items, summary.firstVisitedByInstitution, summary.firstVisitedByPlace, 2024)).toBe(1);
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
