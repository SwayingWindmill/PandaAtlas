import { describe, expect, it } from "vitest";

import type { Owners, Update } from "./changes";
import { namesLine, newborns, releasesThisWeek, weekDigest } from "./week";

type Target = Update["targets"][number];

function release(releaseId: string, publishedAt: string, targets: Target[], partial: Partial<Update> = {}): Update {
  return {
    updateId: `u-${releaseId}`,
    updateType: "release_activated",
    releaseId,
    releaseVersion: `v-${releaseId}`,
    occurredAt: publishedAt,
    publishedAt,
    targets,
    ...partial,
  };
}

const t = (
  resourceKind: Target["resourceKind"],
  resourceId: string,
  changeType: Target["changeType"] = "added",
): Target => ({
  resourceKind,
  resourceId,
  changeType,
});

const owners: Pick<Owners, "residencies" | "events"> = {
  residencies: [
    {
      residencyId: "r1",
      pandaId: "mover",
      placeId: "x",
      residencyType: "primary",
      startOn: "2026-10-20",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [],
    },
    {
      residencyId: "r-old",
      pandaId: "stale",
      placeId: "x",
      residencyType: "primary",
      startOn: "2011-02-21",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [],
    },
    {
      residencyId: "r2",
      pandaId: "newbie",
      placeId: "x",
      residencyType: "primary",
      startOn: "2026-10-01",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [],
    },
  ],
  events: [
    {
      eventId: "e-birth",
      eventType: "birth",
      eventStatus: "completed",
      occurredOn: "2026-08-01",
      occurredPrecision: "day",
      participantIds: ["cub", "mum"],
      sourceIds: [],
    },
    {
      eventId: "e-plan",
      eventType: "transfer",
      eventStatus: "announced",
      occurredPrecision: "day",
      participantIds: ["planned"],
      sourceIds: [],
    },
    {
      eventId: "e-home",
      eventType: "return",
      eventStatus: "completed",
      occurredOn: "2026-10-27",
      occurredPrecision: "day",
      participantIds: ["homer"],
      sourceIds: [],
    },
    {
      eventId: "e-old",
      eventType: "birth",
      eventStatus: "completed",
      occurredOn: "2021-06-23",
      occurredPrecision: "day",
      participantIds: ["old"],
      sourceIds: [],
    },
    {
      eventId: "e-obs",
      eventType: "observation",
      eventStatus: "completed",
      occurredPrecision: "day",
      participantIds: ["seen"],
      sourceIds: [],
    },
  ],
};

const known = new Map<string, string | null>([
  ["cub", null],
  ["mum", "2006-08-13"],
  ["mover", null],
  ["newbie", null],
  ["homer", null],
  ["planned", null],
  ["seen", null],
  ["old", "2021-06-23"],
  ["stale", null],
]);
// Friday 30 October 2026, 09:00 local.
const now = new Date(2026, 9, 30, 9, 0);

describe("releasesThisWeek", () => {
  it("keeps the seven local days ending now, and drops releases a rollback undid", () => {
    const releases = [
      release("old", new Date(2026, 9, 23, 23, 59).toISOString(), []),
      release("first-day", new Date(2026, 9, 24, 0, 1).toISOString(), []),
      release("undone", new Date(2026, 9, 28).toISOString(), []),
      release("back", new Date(2026, 9, 29).toISOString(), [], {
        updateType: "release_rolled_back",
        previousReleaseId: "undone",
      }),
      release("future", new Date(2026, 9, 30, 10).toISOString(), []),
    ];
    expect(releasesThisWeek(releases, now).map((r) => r.releaseId)).toEqual(["first-day"]);
  });
});

describe("weekDigest", () => {
  it("is null when the week brought nothing a fan would call news", () => {
    expect(weekDigest([], owners, known, now)).toBeNull();
    const quiet = release("q", new Date(2026, 9, 29).toISOString(), [
      t("panda", "cub", "changed"),
      t("evidence", "s1"),
      t("life_event", "e-plan"),
      t("life_event", "e-obs"),
      // A 2021 birth recorded this week is the atlas catching up, not news.
      t("life_event", "e-old"),
      t("residency", "r-old"),
      t("panda", "gone", "added"),
      t("media", "m1", "removed"),
    ]);
    expect(weekDigest([quiet], owners, known, now)).toBeNull();
  });

  it("groups the week's pandas by kind, counts photos and names its releases", () => {
    const digest = weekDigest(
      [
        release("a", new Date(2026, 9, 26).toISOString(), [
          t("life_event", "e-birth"),
          t("media", "m1"),
          t("residency", "r1"),
        ]),
        release("b", new Date(2026, 9, 29).toISOString(), [
          t("life_event", "e-home"),
          t("media", "m2"),
          t("panda", "newbie"),
          t("residency", "r2"),
        ]),
      ],
      owners,
      known,
      now,
    );
    expect(digest).toEqual({
      range: "10月24日–10月30日",
      groups: [
        // The mother is named on the birth; only the cub was born.
        { kind: "born", label: "新生", pandaIds: ["cub"] },
        { kind: "moved", label: "搬家", pandaIds: ["mover"] },
        { kind: "home", label: "回国", pandaIds: ["homer"] },
        // Its new home came with it; it is not a move.
        { kind: "added", label: "新收录", pandaIds: ["newbie"] },
      ],
      photos: 2,
      releases: ["v-a", "v-b"],
    });
  });
});

describe("newborns", () => {
  it("picks the participants born that day: twins both, a mother not", () => {
    const dates = new Map([
      ["a", "2021-06-23"],
      ["b", "2021-06-23"],
      ["mum", "2006-08-13"],
    ]);
    expect(newborns({ occurredOn: "2021-06-23", participantIds: ["a", "b"] }, dates)).toEqual(["a", "b"]);
    expect(newborns({ occurredOn: "2021-06-23", participantIds: ["a", "mum"] }, dates)).toEqual(["a"]);
    expect(newborns({ occurredOn: "2021-06-23", participantIds: ["x", "mum"] }, dates)).toEqual(["x"]);
  });
});

describe("namesLine", () => {
  it("names a few and counts the rest", () => {
    expect(namesLine(["宝力", "青宝"])).toBe("宝力、青宝");
    expect(namesLine(["一", "二", "三", "四", "五"])).toBe("一、二、三等 5 只");
  });
});
