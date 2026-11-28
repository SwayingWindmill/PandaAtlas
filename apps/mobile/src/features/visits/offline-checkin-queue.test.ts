import { describe, expect, it } from "vitest";

import {
  OFFLINE_CHECKIN_QUEUE_KEY,
  QUEUED_VISIT_PREFIX,
  isQueuedVisitId,
  mergeSeenWithQueue,
  mergeVisitsWithQueue,
  pruneQueuedCheckinProgress,
  queueKeyFromVisitId,
  queuedCheckinKey,
  removeQueuedCheckinByKey,
  upsertQueuedCheckin,
} from "./offline-checkin-queue-model";

describe("offline-checkin-queue-model", () => {
  it("uses a dedicated key outside the offline:* read cache namespace", () => {
    expect(OFFLINE_CHECKIN_QUEUE_KEY.startsWith("offline:")).toBe(false);
  });

  it("merges duplicate (accountId, placeId, visitedOn) writes idempotently by unioning pandas and notes", () => {
    const step1 = upsertQueuedCheckin([], {
      accountId: "acc-1",
      placeId: "place-cd",
      visitedOn: "2026-11-28",
      note: "早上逛幼年别墅",
      pandaIds: ["p-hehua"],
      nowIso: "2026-11-28T09:00:00Z",
    });
    const step2 = upsertQueuedCheckin(step1, {
      accountId: "acc-1",
      placeId: "place-cd",
      visitedOn: "2026-11-28",
      note: "",
      pandaIds: ["p-hehua", "p-heye"],
      nowIso: "2026-11-28T09:30:00Z",
    });

    expect(step2).toHaveLength(1);
    expect(step2[0]).toMatchObject({
      key: "acc-1:place-cd:2026-11-28",
      note: "早上逛幼年别墅",
      pandaIds: ["p-hehua", "p-heye"],
      visitSynced: false,
    });
  });

  it("prunes only completed visit/pandas and preserves failed remainders", () => {
    const key = queuedCheckinKey("acc-1", "place-cd", "2026-11-28");
    const list = upsertQueuedCheckin([], {
      accountId: "acc-1",
      placeId: "place-cd",
      visitedOn: "2026-11-28",
      pandaIds: ["p-1", "p-2"],
      nowIso: "2026-11-28T09:00:00Z",
    });

    const partial = pruneQueuedCheckinProgress(list, key, true, new Set(["p-1"]), "network error");
    expect(partial).toHaveLength(1);
    expect(partial[0]).toMatchObject({ visitSynced: true, pandaIds: ["p-2"], lastError: "network error" });

    const updatedMidFlight = upsertQueuedCheckin(partial, {
      accountId: "acc-1",
      placeId: "place-cd",
      visitedOn: "2026-11-28",
      note: "补记一句小记",
      nowIso: "2026-11-28T10:00:00Z",
    });
    expect(updatedMidFlight[0]!.lastError).toBeUndefined();
    expect(updatedMidFlight[0]!.visitSynced).toBe(false);

    // Flushing the older null note in parallel must not mark the newer note as visitSynced.
    const preservedNewNote = pruneQueuedCheckinProgress(
      updatedMidFlight,
      key,
      true,
      new Set(["p-2"]),
      undefined,
      null,
    );
    expect(preservedNewNote).toHaveLength(1);
    expect(preservedNewNote[0]).toMatchObject({
      note: "补记一句小记",
      visitSynced: false,
      pandaIds: [],
    });

    const done = pruneQueuedCheckinProgress(preservedNewNote, key, true, new Set(), undefined, "补记一句小记");
    expect(done).toHaveLength(0);
  });

  it("merges server visits and seen entries with queued items without duplicates", () => {
    const queued = upsertQueuedCheckin([], {
      accountId: "acc-1",
      placeId: "place-cd",
      visitedOn: "2026-11-28",
      note: "排队小记",
      pandaIds: ["p-hehua", "p-heye"],
      nowIso: "2026-11-28T09:00:00Z",
    });

    const merged = mergeVisitsWithQueue(
      [
        {
          checkinId: "srv-old",
          placeId: "place-bj",
          visitedOn: "2026-11-12",
          note: null,
          createdAt: "2026-11-12T08:00:00Z",
        },
      ],
      queued,
    );
    expect(merged.map((v) => v.visitedOn)).toEqual(["2026-11-28", "2026-11-12"]);
    expect(isQueuedVisitId(merged[0]!.checkinId)).toBe(true);
    expect(merged[0]!.checkinId).toBe(`${QUEUED_VISIT_PREFIX}${queued[0]!.key}`);
    expect(queueKeyFromVisitId(merged[0]!.checkinId)).toBe(queued[0]!.key);

    const seen = mergeSeenWithQueue(
      [{ pandaId: "p-hehua", seenOn: "2026-11-28", placeId: "place-cd", note: null }],
      queued,
    );
    expect(seen).toHaveLength(2);
    expect(seen.map((s) => s.pandaId)).toEqual(["p-hehua", "p-heye"]);

    expect(removeQueuedCheckinByKey(queued, queued[0]!.key)).toEqual([]);
  });
});
