import { describe, expect, it } from "vitest";

import type { SeenEntry } from "@/features/engagement/seen";
import type { PandaListItem } from "@/features/pandas/pandas";
import type { Visit } from "@/features/visits/visits";

import { groupVisitsByYear, matchSeenPandasForVisit } from "./visit-diary";

function makePanda(overrides: Partial<PandaListItem> & Pick<PandaListItem, "id" | "name">): PandaListItem {
  return {
    slug: overrides.id,
    sex: "female",
    birthDate: "2020-07-04",
    deceased: false,
    place: "成都基地",
    placeId: "place-cd",
    area: "成都",
    hasFullBleedCover: true,
    terms: [overrides.name],
    initials: [],
    ...overrides,
  };
}

function makeVisit(overrides: Partial<Visit> & Pick<Visit, "checkinId" | "placeId" | "visitedOn">): Visit {
  return {
    note: null,
    createdAt: `${overrides.visitedOn}T10:00:00Z`,
    ...overrides,
  };
}

describe("matchSeenPandasForVisit", () => {
  const heHua = makePanda({ id: "p-hua", name: "和花", placeId: "place-cd" });
  const mengLan = makePanda({ id: "p-lan", name: "萌兰", placeId: "place-bj", place: "北京动物园" });
  const fuBao = makePanda({ id: "p-fu", name: "福宝", placeId: "place-wl", place: "卧龙神树坪" });
  const index = new Map([
    [heHua.id, heHua],
    [mengLan.id, mengLan],
    [fuBao.id, fuBao],
  ]);

  it("matches entries with identical seenOn and placeId and deduplicates by pandaId", () => {
    const visit = makeVisit({ checkinId: "v1", placeId: "place-cd", visitedOn: "2026-11-25" });
    const entries: SeenEntry[] = [
      { pandaId: "p-hua", seenOn: "2026-11-25", placeId: "place-cd", note: null },
      { pandaId: "p-hua", seenOn: "2026-11-25", placeId: "place-cd", note: null },
      { pandaId: "p-lan", seenOn: "2026-11-25", placeId: "place-bj", note: null },
    ];

    expect(matchSeenPandasForVisit(visit, entries, index).map((p) => p.id)).toEqual(["p-hua"]);
  });

  it("falls back to panda.placeId for legacy entries with null placeId", () => {
    const visit = makeVisit({ checkinId: "v1", placeId: "place-bj", visitedOn: "2026-10-01" });
    const entries: SeenEntry[] = [
      { pandaId: "p-lan", seenOn: "2026-10-01", placeId: null, note: null },
      { pandaId: "p-hua", seenOn: "2026-10-01", placeId: null, note: null },
    ];

    expect(matchSeenPandasForVisit(visit, entries, index).map((p) => p.id)).toEqual(["p-lan"]);
  });

  it("does not fall back to panda.placeId when entry.placeId is explicitly a different place", () => {
    const visit = makeVisit({ checkinId: "v1", placeId: "place-cd", visitedOn: "2026-11-25" });
    const entries: SeenEntry[] = [
      // Panda currently lives at place-cd, but was marked seen at place-wl on that day.
      { pandaId: "p-hua", seenOn: "2026-11-25", placeId: "place-wl", note: null },
    ];

    expect(matchSeenPandasForVisit(visit, entries, index)).toEqual([]);
  });

  it("skips entries with mismatched dates, null seenOn, or missing index entries", () => {
    const visit = makeVisit({ checkinId: "v1", placeId: "place-wl", visitedOn: "2026-11-25" });
    const entries: SeenEntry[] = [
      { pandaId: "p-fu", seenOn: "2026-11-24", placeId: "place-wl", note: null },
      { pandaId: "p-fu", seenOn: null, placeId: "place-wl", note: null },
      { pandaId: "p-unknown", seenOn: "2026-11-25", placeId: "place-wl", note: null },
    ];

    expect(matchSeenPandasForVisit(visit, entries, index)).toEqual([]);
  });
});

describe("groupVisitsByYear", () => {
  it("groups visits by year newest first and sorts visits newest-first within each year", () => {
    const visits = [
      makeVisit({ checkinId: "v1", placeId: "p1", visitedOn: "2025-05-02" }),
      makeVisit({ checkinId: "v2", placeId: "p2", visitedOn: "2026-10-14" }),
      makeVisit({ checkinId: "v3", placeId: "p1", visitedOn: "2026-11-25" }),
      makeVisit({ checkinId: "v4", placeId: "p3", visitedOn: "2026-11-25", createdAt: "2026-11-25T15:00:00Z" }),
    ];

    const grouped = groupVisitsByYear(visits);
    expect(grouped.map((g) => g.year)).toEqual(["2026", "2025"]);
    expect(grouped[0]?.visits.map((v) => v.checkinId)).toEqual(["v4", "v3", "v2"]);
    expect(grouped[1]?.visits.map((v) => v.checkinId)).toEqual(["v1"]);
  });
});
