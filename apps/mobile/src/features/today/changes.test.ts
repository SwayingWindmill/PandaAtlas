import { describe, expect, it } from "vitest";

import { type Owners, type Update, followedChanges } from "./changes";

const update = (publishedAt: string, targets: Update["targets"]): Update => ({
  updateId: publishedAt,
  updateType: "release_activated",
  releaseId: "r",
  releaseVersion: "v",
  occurredAt: publishedAt,
  publishedAt,
  targets,
});

const owners: Owners = {
  lineage: [{ assertionId: "l1", childId: "cub", parentId: "mom", parentRole: "mother", sourceIds: [] }],
  residencies: [
    {
      residencyId: "home1",
      pandaId: "mom",
      placeId: "p",
      residencyType: "primary",
      startPrecision: "day",
      status: "confirmed",
      sourceIds: [],
    },
  ],
  events: [
    {
      eventId: "e1",
      eventType: "arrival",
      eventStatus: "completed",
      occurredPrecision: "day",
      participantIds: ["cub", "other"],
      sourceIds: [],
    },
  ],
};

describe("followedChanges", () => {
  it("collects direct and linked changes per followed panda, newest first", () => {
    const updates = [
      update("2026-10-26T00:00:00.000Z", [
        { resourceKind: "life_event", resourceId: "e1", changeType: "added" },
        { resourceKind: "panda", resourceId: "cub", changeType: "changed" },
        { resourceKind: "lineage", resourceId: "l1", changeType: "added" },
      ]),
      update("2026-10-01T00:00:00.000Z", [
        { resourceKind: "residency", resourceId: "home1", changeType: "changed" },
        { resourceKind: "panda", resourceId: "cub", changeType: "changed" },
      ]),
    ];
    expect(followedChanges(updates, new Set(["cub", "mom"]), owners)).toEqual([
      { pandaId: "cub", what: "资料有更新、新增经历、家谱有新记录", publishedAt: "2026-10-26T00:00:00.000Z" },
      { pandaId: "mom", what: "家谱有新记录、住处有更新", publishedAt: "2026-10-26T00:00:00.000Z" },
    ]);
  });

  it("leaves out pandas not followed, removed resources, and kinds that are not about one panda", () => {
    const updates = [
      update("2026-10-26T00:00:00.000Z", [
        { resourceKind: "panda", resourceId: "other", changeType: "added" },
        { resourceKind: "panda", resourceId: "cub", changeType: "removed" },
        { resourceKind: "evidence", resourceId: "src", changeType: "added" },
        { resourceKind: "media", resourceId: "m", changeType: "added" },
      ]),
    ];
    expect(followedChanges(updates, new Set(["cub"]), owners)).toEqual([]);
  });
});
