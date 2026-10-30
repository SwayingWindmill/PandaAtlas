import { describe, expect, it } from "vitest";

import { type Evidence, type LifeEvent, type Residency, buildTimeline, dayLabel } from "./timeline";

const PANDA = "p1";
const PLACES: Record<string, string> = {
  ueno: "上野动物园",
  wolong: "卧龙神树坪基地",
  dc: "史密森尼国家动物园",
  cn: "中国",
};
const place = (id: string | undefined) => (id ? (PLACES[id] ?? null) : null);

function event(partial: Partial<LifeEvent> & Pick<LifeEvent, "eventId" | "eventType">): LifeEvent {
  return {
    eventStatus: "completed",
    occurredPrecision: "day",
    participantIds: [PANDA],
    sourceIds: [],
    ...partial,
  };
}

function stay(partial: Partial<Residency> & Pick<Residency, "residencyId" | "placeId">): Residency {
  return {
    pandaId: PANDA,
    residencyType: "primary",
    startPrecision: "day",
    status: "confirmed",
    sourceIds: [],
    ...partial,
  };
}

function source(sourceId: string): Evidence {
  return {
    sourceId,
    publisher: `Publisher ${sourceId}`,
    title: `Title ${sourceId}`,
    url: `https://example.org/${sourceId}`,
    lastVerifiedOn: "2026-01-01",
    languageTag: "zh",
    accessState: "public",
  } as Evidence;
}

const base = { pandaId: PANDA, place, birthDate: null, evidence: ["s1", "s2", "s3", "s4"].map(source) };

describe("buildTimeline", () => {
  it("tells an arrival and the stay it starts once, with the sources of both", () => {
    const timeline = buildTimeline({
      ...base,
      events: [
        event({ eventId: "e1", eventType: "arrival", occurredOn: "2011-02-21", toPlaceId: "ueno", sourceIds: ["s1"] }),
      ],
      residencies: [stay({ residencyId: "r1", placeId: "ueno", startOn: "2011-02-21", sourceIds: ["s2", "s1"] })],
    });
    expect(timeline.count).toBe(1);
    const [milestone] = timeline.years[0]!.milestones;
    expect(milestone!.text).toBe("抵达上野动物园");
    expect(milestone!.sources.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("folds a stay's end into the transfer that day, and orders oldest first by year", () => {
    const timeline = buildTimeline({
      ...base,
      birthDate: "2005-07-03",
      events: [
        event({
          eventId: "t",
          eventType: "transfer",
          occurredOn: "2024-09-29",
          fromPlaceId: "ueno",
          toPlaceId: "wolong",
          sourceIds: ["s3"],
        }),
        event({ eventId: "b", eventType: "birth", occurredOn: "2005-07-03", sourceIds: ["s1"] }),
      ],
      residencies: [
        stay({
          residencyId: "r1",
          placeId: "ueno",
          startOn: "2011-02-21",
          endOn: "2024-09-29",
          endPrecision: "day",
          sourceIds: ["s2"],
        }),
        stay({ residencyId: "r2", placeId: "wolong", startOn: "2024-09-29", sourceIds: ["s4"] }),
      ],
    });
    expect(timeline.years.map((year) => [year.year, year.age])).toEqual([
      ["2005", undefined],
      ["2011", "6 岁"],
      ["2024", "19 岁"],
    ]);
    expect(timeline.years[1]!.milestones[0]!.text).toBe("住进上野动物园");
    const move = timeline.years[2]!.milestones;
    expect(move).toHaveLength(1);
    expect(move[0]!.text).toBe("从上野动物园搬到卧龙神树坪基地");
    expect(move[0]!.sources.map((s) => s.id).sort()).toEqual(["s2", "s3", "s4"]);
    expect(timeline.summary).toBe("3 个里程碑 · 2005–2024 · 住过 2 个地方");
  });

  it("joins two back-to-back stays into one move when no event tells it", () => {
    const timeline = buildTimeline({
      ...base,
      events: [],
      residencies: [
        stay({
          residencyId: "r1",
          placeId: "dc",
          startOn: "2000-12-06",
          endOn: "2019-11-19",
          endPrecision: "day",
          sourceIds: ["s1"],
        }),
        stay({ residencyId: "r2", placeId: "wolong", startOn: "2019-11-19", sourceIds: ["s2"] }),
      ],
    });
    const texts = timeline.years.flatMap((year) => year.milestones.map((m) => m.text));
    expect(texts).toEqual(["住进史密森尼国家动物园", "从史密森尼国家动物园搬到卧龙神树坪基地"]);
  });

  it("says 离开 for a stay that ends with nothing after it", () => {
    const timeline = buildTimeline({
      ...base,
      events: [],
      residencies: [
        stay({
          residencyId: "r1",
          placeId: "dc",
          startOn: "2000-12",
          startPrecision: "month",
          endOn: "2019",
          endPrecision: "year",
        }),
      ],
    });
    const milestones = timeline.years.flatMap((year) => year.milestones);
    expect(milestones.map((m) => [m.date, m.dayLabel, m.text])).toEqual([
      ["2000-12", "12月", "住进史密森尼国家动物园"],
      ["2019", "", "离开史密森尼国家动物园"],
    ]);
  });

  it("leaves out announced plans, other pandas' events, unknown types and unknown sources", () => {
    const timeline = buildTimeline({
      ...base,
      events: [
        event({
          eventId: "a",
          eventType: "transfer",
          eventStatus: "announced",
          occurredOn: "2027-01-01",
          toPlaceId: "dc",
        }),
        event({ eventId: "b", eventType: "birth", occurredOn: "2020-01-01", participantIds: ["other"] }),
        event({ eventId: "c", eventType: "observation", occurredOn: "2024-04-01" }),
        event({
          eventId: "d",
          eventType: "public_debut",
          occurredOn: "2025-01-24",
          toPlaceId: "dc",
          sourceIds: ["gone"],
        }),
      ],
      residencies: [],
    });
    const milestones = timeline.years.flatMap((year) => year.milestones);
    expect(milestones.map((m) => m.text)).toEqual(["在史密森尼国家动物园首次与公众见面"]);
    expect(milestones[0]!.sources).toEqual([]);
  });

  it("brackets the life with the profile's dates when no event records them, without inventing a source", () => {
    const timeline = buildTimeline({
      ...base,
      birthDate: "1999-08-27",
      deathDate: "2023-04-26",
      events: [],
      residencies: [],
    });
    const milestones = timeline.years.flatMap((year) => year.milestones);
    expect(milestones.map((m) => [m.kind, m.sources.length])).toEqual([
      ["birth", 0],
      ["death", 0],
    ]);
    expect(milestones[0]!.note).toContain("没有单独的出处");
  });

  it("marks a country-level stay and keeps undated stays after the dated ones", () => {
    const timeline = buildTimeline({
      ...base,
      events: [],
      residencies: [stay({ residencyId: "r1", placeId: "cn", status: "confirmed_country_level" })],
    });
    expect(timeline.years).toEqual([]);
    expect(timeline.undated.map((m) => [m.text, m.note])).toEqual([["住在中国", "只知道所在国家，具体机构暂无记录"]]);
    expect(timeline.summary).toBe("1 个里程碑 · 住过 1 个地方");
  });

  it("tells a mother's entry in her cub's birth as the cub's arrival, not her own birth", () => {
    const timeline = buildTimeline({
      ...base,
      birthDate: "2006-08-13",
      events: [
        event({
          eventId: "b",
          eventType: "birth",
          occurredOn: "2017-07-26",
          toPlaceId: "wolong",
          participantIds: ["cub", PANDA],
        }),
      ],
      residencies: [],
    });
    expect(timeline.years.flatMap((year) => year.milestones.map((m) => [m.kind, m.text]))).toEqual([
      ["birth", "出生"],
      ["cub", "在卧龙神树坪基地迎来幼崽出生"],
    ]);
  });

  it("has no summary when there is nothing on record", () => {
    expect(buildTimeline({ ...base, events: [], residencies: [] })).toMatchObject({
      count: 0,
      summary: null,
      years: [],
    });
  });
});

describe("dayLabel", () => {
  it("is as precise as the date", () => {
    expect(dayLabel("2024-10-05")).toBe("10月5日");
    expect(dayLabel("2024-10")).toBe("10月");
    expect(dayLabel("2024")).toBe("");
  });
});
