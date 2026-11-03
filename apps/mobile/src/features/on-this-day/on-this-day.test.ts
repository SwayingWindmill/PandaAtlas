import { describe, expect, it } from "vitest";

import type { LifeEvent, Residency } from "../timeline/timeline";

import {
  DECEASED_POLICY,
  type Memory,
  type MemoryInput,
  type MemoryPanda,
  type MemoryPlace,
  anniversaryYears,
  memoriesOn,
  ownRecord,
  pickForCard,
  visibleMemories,
} from "./on-this-day";

const panda = (id: string, birthDate: string | null, deceased = false): MemoryPanda => ({
  id,
  slug: `slug-${id}`,
  name: `熊猫${id}`,
  birthDate,
  deceased,
});

const place = (id: string, name: string | null, countryCode: string | null): MemoryPlace => ({
  id,
  slug: `place-${id}`,
  name,
  countryCode,
});

const event = (over: Partial<LifeEvent> & Pick<LifeEvent, "eventId" | "eventType" | "occurredOn">): LifeEvent => ({
  eventStatus: "completed",
  occurredPrecision: "day",
  participantIds: ["a"],
  sourceIds: ["src-1"],
  ...over,
});

const stay = (over: Partial<Residency> & Pick<Residency, "residencyId" | "placeId">): Residency => ({
  pandaId: "a",
  residencyType: "primary",
  startPrecision: "day",
  status: "confirmed",
  sourceIds: ["src-stay"],
  ...over,
});

const places = new Map([
  ["ueno", place("ueno", "上野动物园", "JP")],
  ["yaan", place("yaan", "雅安碧峰峡基地", "CN")],
  ["chengdu", place("chengdu", "成都大熊猫繁育研究基地", "CN")],
  ["country", place("country", null, null)],
  ["china", { ...place("china", "中国", "CN"), countryLevel: true }],
]);

const base = (over: Partial<MemoryInput>): MemoryInput => ({
  today: "2026-10-30",
  pandas: [panda("a", "2020-07-20")],
  events: [],
  residencies: [],
  places,
  ...over,
});

describe("anniversaryYears", () => {
  it("counts whole years on the same month and day only", () => {
    expect(anniversaryYears("2023-10-30", "2026-10-30")).toBe(3);
    expect(anniversaryYears("2023-10-29", "2026-10-30")).toBeNull();
    expect(anniversaryYears("2023-11-30", "2026-10-30")).toBeNull();
  });

  it("leaves the day itself and partial dates out", () => {
    expect(anniversaryYears("2026-10-30", "2026-10-30")).toBeNull();
    expect(anniversaryYears("2023-10", "2026-10-30")).toBeNull();
    expect(anniversaryYears(null, "2026-10-30")).toBeNull();
  });

  it("remembers 2月29日 on 2月28日 in a common year, and on the 29th in a leap year", () => {
    expect(anniversaryYears("2020-02-29", "2027-02-28")).toBe(7);
    expect(anniversaryYears("2020-02-29", "2028-02-28")).toBeNull();
    expect(anniversaryYears("2020-02-29", "2028-02-29")).toBe(8);
  });
});

describe("memoriesOn", () => {
  it("tells a living panda's birthday with its age, and cites the birth event when one records that day", () => {
    const memories = memoriesOn(
      base({
        today: "2026-07-20",
        events: [event({ eventId: "birth", eventType: "birth", occurredOn: "2020-07-20", sourceIds: ["src-birth"] })],
      }),
    );
    expect(memories).toEqual([
      expect.objectContaining({ kind: "birthday", text: "6 岁生日", sourceIds: ["src-birth"], years: 6 }),
    ]);
  });

  it("says a birthday with no birth event comes from the profile, without inventing a source", () => {
    const [memory] = memoriesOn(base({ today: "2026-07-20" }));
    expect(memory?.sourceIds).toEqual([]);
    expect(memory && ownRecord(memory)).toBe("来自资料卡，这一条还没有单独的出处");
  });

  it("calls a move from abroad to China coming home, and a move inside China an arrival", () => {
    const memories = memoriesOn(
      base({
        today: "2027-01-28",
        events: [
          event({ eventId: "home", eventType: "transfer", occurredOn: "2026-01-28", fromPlaceId: "ueno", toPlaceId: "yaan" }),
          event({ eventId: "move", eventType: "transfer", occurredOn: "2025-01-28", fromPlaceId: "yaan", toPlaceId: "chengdu" }),
        ],
      }),
    );
    expect(memories.map((memory) => [memory.kind, memory.text])).toEqual([
      ["home", "1 年前的今天回国，住进雅安碧峰峡基地"],
      ["arrival", "2 年前的今天从雅安碧峰峡基地搬到成都大熊猫繁育研究基地"],
    ]);
  });

  it("says only 回国 when all that is known is the country", () => {
    const [memory] = memoriesOn(
      base({
        today: "2027-11-08",
        events: [event({ eventId: "e", eventType: "transfer", occurredOn: "2023-11-08", fromPlaceId: "ueno", toPlaceId: "china" })],
      }),
    );
    expect(memory).toEqual(expect.objectContaining({ kind: "home", text: "4 年前的今天回国" }));
  });

  it("does not call a move home when a country is unknown", () => {
    const [memory] = memoriesOn(
      base({
        today: "2027-01-28",
        events: [event({ eventId: "e", eventType: "transfer", occurredOn: "2026-01-28", fromPlaceId: "country", toPlaceId: "yaan" })],
      }),
    );
    expect(memory?.kind).toBe("arrival");
  });

  it("skips events without a source, without a day, not yet happened, or of other kinds", () => {
    const memories = memoriesOn(
      base({
        today: "2027-01-28",
        events: [
          event({ eventId: "1", eventType: "arrival", occurredOn: "2026-01-28", toPlaceId: "yaan", sourceIds: [] }),
          event({ eventId: "2", eventType: "arrival", occurredOn: "2026-01-28", toPlaceId: "yaan", occurredPrecision: "month" }),
          event({ eventId: "3", eventType: "arrival", occurredOn: "2026-01-28", toPlaceId: "yaan", eventStatus: "planned" }),
          event({ eventId: "4", eventType: "public_debut", occurredOn: "2026-01-28", toPlaceId: "yaan" }),
        ],
      }),
    );
    expect(memories).toEqual([]);
  });

  it("tells a sourced stay that starts on the day, unless an event already told it or it is the birthplace", () => {
    const residencies = [
      stay({ residencyId: "ueno", placeId: "ueno", startOn: "2011-02-21", endOn: "2024-09-29" }),
      stay({ residencyId: "yaan", placeId: "yaan", startOn: "2024-09-29" }),
    ];
    expect(memoriesOn(base({ today: "2026-09-29", residencies })).map((memory) => [memory.kind, memory.text])).toEqual([
      ["home", "2 年前的今天回国，住进雅安碧峰峡基地"],
    ]);
    const told = [event({ eventId: "e", eventType: "return", occurredOn: "2024-09-29", toPlaceId: "yaan" })];
    expect(memoriesOn(base({ today: "2026-09-29", residencies, events: told }))).toHaveLength(1);
    const born = [stay({ residencyId: "b", placeId: "chengdu", startOn: "2020-07-20" })];
    expect(memoriesOn(base({ today: "2026-07-20", residencies: born })).map((memory) => memory.kind)).toEqual(["birthday"]);
  });

  it("leaves deceased pandas out unless asked for, and then never calls it a birthday", () => {
    const pandas = [panda("a", "2000-08-21", true)];
    const events = [event({ eventId: "d", eventType: "death", occurredOn: "2020-10-30", toPlaceId: "chengdu" })];
    expect(memoriesOn(base({ today: "2026-08-21", pandas }))).toEqual([]);
    expect(memoriesOn(base({ today: "2026-08-21", pandas, includeDeceased: true }))[0]?.text).toBe("26 年前的今天出生");
    expect(memoriesOn(base({ pandas, events, includeDeceased: true }))[0]).toEqual(
      expect.objectContaining({ kind: "death", text: "6 年前的今天在成都大熊猫繁育研究基地离世", deceased: true }),
    );
  });

  it("tells the fan's own records first, in their own words", () => {
    const memories = memoriesOn(
      base({
        today: "2026-07-20",
        personal: {
          seen: [{ pandaId: "a", seenOn: "2025-07-20", placeId: "chengdu" }],
          recognized: [{ pandaId: "a", firstGame: "daily_panda", firstMetAt: "2024-07-20T12:00:00" }],
          visits: [
            { checkinId: "c1", placeId: "yaan", visitedOn: "2023-07-20" },
            { checkinId: "c2", placeId: "yaan", visitedOn: "2023-07-20" },
          ],
        },
      }),
    );
    expect(memories.map((memory) => memory.text)).toEqual([
      "1 年前的今天，你在成都大熊猫繁育研究基地见过它",
      "2 年前的今天，你在每日一猫第一次认出它",
      "3 年前的今天，你去过这里",
      "6 岁生日",
    ]);
    expect(memories.map(ownRecord)).toEqual(["来自你的图鉴", "来自你的图鉴", "来自你的到访记录", "来自资料卡，这一条还没有单独的出处"]);
  });

  it("keeps to one panda on its own page and leaves visits out there", () => {
    const memories = memoriesOn(
      base({
        today: "2026-07-20",
        pandas: [panda("a", "2020-07-20"), panda("b", "2021-07-20")],
        personal: { seen: [], recognized: [], visits: [{ checkinId: "c", placeId: "yaan", visitedOn: "2025-07-20" }] },
        pandaId: "b",
      }),
    );
    expect(memories.map((memory) => memory.subject.id)).toEqual(["b"]);
  });
});

describe("visibleMemories", () => {
  it("drops what the fan shows less of and, by policy, deceased pandas", () => {
    const memories = memoriesOn(
      base({
        today: "2026-07-20",
        pandas: [panda("a", "2020-07-20"), panda("b", "2021-07-20"), panda("c", "2000-07-20", true)],
        includeDeceased: true,
      }),
    );
    expect(memories).toHaveLength(3);
    const shown = visibleMemories(memories, { off: false, less: ["panda:a"] });
    expect(shown.map((memory) => memory.subject.id)).toEqual(DECEASED_POLICY.onToday ? ["b", "c"] : ["b"]);
  });
});

describe("pickForCard", () => {
  const memory = (key: string, kind: Memory["kind"]) => ({ key, kind }) as Memory;
  it("takes one from each group before a second from any, in the page's order", () => {
    const all = [memory("s1", "seen"), memory("s2", "recognized"), memory("v", "visit"), memory("h1", "home"), memory("h2", "home"), memory("b", "birthday")];
    expect(pickForCard(all, 3).map((item) => item.key)).toEqual(["s1", "h1", "b"]);
    expect(pickForCard(all, 5).map((item) => item.key)).toEqual(["s1", "s2", "h1", "h2", "b"]);
    expect(pickForCard(all.slice(0, 2), 3).map((item) => item.key)).toEqual(["s1", "s2"]);
  });
});

describe("里程碑 on 那年今天", () => {
  it("tells a living cub's 满月 and 满百天 with the birth's sources, and not a deceased cub's", () => {
    const events = [event({ eventId: "b", eventType: "birth", occurredOn: "2026-06-03", participantIds: ["cub"] })];
    const pandas = [panda("cub", "2026-06-03"), panda("gone", "2026-06-03", true)];
    const month = memoriesOn(base({ today: "2026-07-03", pandas, events }));
    expect(month.map((memory) => [memory.kind, memory.subject.key, memory.text, memory.years])).toEqual([
      ["month", "panda:cub", "今天满月", 0],
    ]);
    expect(month[0]!.sourceIds).toEqual(["src-1"]);
    const hundred = memoriesOn(base({ today: "2026-09-11", pandas, events: [] }));
    expect(hundred.map((memory) => memory.kind)).toEqual(["hundred"]);
    expect(ownRecord(hundred[0]!)).toBe("按资料卡的出生日期推算");
  });

  it("goes with the 里程碑 switch: off drops 满月 and the note", () => {
    const memories = memoriesOn(base({ today: "2026-07-03", pandas: [panda("cub", "2026-06-03")] }));
    expect(visibleMemories(memories, { off: false, less: [] }, true)).toHaveLength(1);
    expect(visibleMemories(memories, { off: false, less: [] }, false)).toHaveLength(0);
  });

  it("says when a record was the fan's 1st panda or first time back, using the 图鉴's numbering", () => {
    const memories = memoriesOn(
      base({
        today: "2026-07-20",
        pandas: [panda("a", null), panda("b", null)],
        personal: {
          seen: [{ pandaId: "b", seenOn: "2025-07-20", placeId: "ueno", firstSeenAt: "2025-07-20T09:00:00Z" }],
          recognized: [{ pandaId: "a", firstGame: "daily_panda", firstMetAt: "2024-07-20T12:00:00" }],
          visits: [
            { checkinId: "v1", placeId: "yaan", visitedOn: "2024-01-01" },
            { checkinId: "v2", placeId: "yaan", visitedOn: "2025-07-20" },
          ],
        },
      }),
    );
    const on = visibleMemories(memories, { off: false, less: [] }, true).map((memory) => memory.text);
    expect(on).toContain("2 年前的今天，你在每日一猫第一次认出它，是你的第一只熊猫");
    expect(on).toContain("1 年前的今天，你去过这里，是你第一次回来");
    // The 2nd panda is no milestone.
    expect(on).toContain("1 年前的今天，你在上野动物园见过它");
    const off = visibleMemories(memories, { off: false, less: [] }, false).map((memory) => memory.text);
    expect(off).toContain("2 年前的今天，你在每日一猫第一次认出它");
  });
});
