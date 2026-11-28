import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enqueueOfflineCheckin,
  flushOfflineCheckins,
  queuedCheckinKey,
  removeOfflineCheckin,
  useQueuedCheckins,
} from "./offline-checkin-queue";
import { OFFLINE_CHECKIN_QUEUE_KEY } from "./offline-checkin-queue-model";

const state = vi.hoisted(() => ({
  stored: new Map<string, string>(),
  events: [] as string[],
}));

const mocks = vi.hoisted(() => ({
  recordVisit: vi.fn<(placeId: string, visitedOn: string, note?: string | null) => Promise<unknown>>(),
  markSeen: vi.fn<(pandaId: string, seenOn: string, placeId?: string | null) => Promise<boolean>>(),
  invalidateQueries: vi.fn<(filter: { queryKey: readonly unknown[] }) => Promise<void>>(),
}));

vi.mock("react", () => ({
  useEffect: vi.fn(),
  useMemo: (fn: () => unknown) => fn(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Platform: { OS: "web" },
}));

vi.mock("expo-network", () => ({
  addNetworkStateListener: vi.fn(() => ({ remove: vi.fn() })),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => state.stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.events.push(`storage:set:${key}:${value}`);
      state.stored.set(key, value);
    },
  },
}));

vi.mock("@/features/session/session", () => ({
  useSession: () => ({ state: { status: "signedOut" } }),
}));

vi.mock("@/features/visits/visits", () => ({
  recordVisit: mocks.recordVisit,
  visitsQueryKey: (accountId: string) => ["private", accountId, "visits"] as const,
}));

vi.mock("@/features/engagement/seen", () => ({
  markSeen: mocks.markSeen,
  seenEntriesQueryKey: (accountId: string) => ["private", accountId, "seen-entries"] as const,
  seenIdsQueryKey: (accountId: string) => ["private", accountId, "seen-ids"] as const,
}));

vi.mock("@/lib/query-client", () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}));

describe("offline-checkin-queue runtime", () => {
  const accountId = "acc-runtime";
  const placeId = "place-cd";
  const visitedOn = "2026-11-28";

  beforeEach(async () => {
    state.stored.clear();
    state.events.length = 0;
    mocks.recordVisit.mockReset();
    mocks.markSeen.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockImplementation(async (filter) => {
      state.events.push(`invalidate:${String(filter.queryKey[2])}`);
    });
    await removeOfflineCheckin(queuedCheckinKey(accountId, placeId, visitedOn));
    state.events.length = 0;
  });

  it("flushes visit before seen pandas, invalidates queries before clearing storage, and runs single-flight", async () => {
    mocks.recordVisit.mockImplementation(async () => {
      state.events.push("recordVisit");
      return { checkinId: "srv-1", placeId, visitedOn, note: "离线小记", createdAt: "2026-11-28T10:00:00Z" };
    });
    mocks.markSeen.mockImplementation(async (pandaId) => {
      state.events.push(`markSeen:${pandaId}`);
      return true;
    });

    await enqueueOfflineCheckin({
      accountId,
      placeId,
      visitedOn,
      note: "离线小记",
      pandaIds: ["p-hehua"],
    });
    expect(useQueuedCheckins(accountId)).toHaveLength(1);
    state.events.length = 0;

    const [first, second] = await Promise.all([flushOfflineCheckins(accountId), flushOfflineCheckins(accountId)]);
    expect(first).toEqual({ synced: 2, remaining: 0 });
    expect(second).toEqual({ synced: 2, remaining: 0 });
    expect(useQueuedCheckins(accountId)).toEqual([]);
    expect(mocks.recordVisit).toHaveBeenCalledTimes(1);
    expect(mocks.markSeen).toHaveBeenCalledTimes(1);

    const visitsInvIdx = state.events.indexOf("invalidate:visits");
    const clearStorageIdx = state.events.findIndex((entry) => entry === `storage:set:${OFFLINE_CHECKIN_QUEUE_KEY}:[]`);
    expect(state.events.indexOf("recordVisit")).toBeLessThan(state.events.indexOf("markSeen:p-hehua"));
    expect(visitsInvIdx).toBeGreaterThan(-1);
    expect(clearStorageIdx).toBeGreaterThan(visitsInvIdx);
    expect(JSON.parse(state.stored.get(OFFLINE_CHECKIN_QUEUE_KEY) ?? "[]")).toEqual([]);
  });

  it("retains the queued entry with lastError on failure and drains cleanly on retry", async () => {
    mocks.recordVisit.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({
      checkinId: "srv-2",
      placeId,
      visitedOn,
      note: null,
      createdAt: "2026-11-28T10:05:00Z",
    });
    mocks.markSeen.mockResolvedValue(true);

    await enqueueOfflineCheckin({
      accountId,
      placeId,
      visitedOn,
      pandaIds: ["p-heye"],
    });

    const failedRun = await flushOfflineCheckins(accountId);
    expect(failedRun).toEqual({ synced: 0, remaining: 1 });
    const persisted = JSON.parse(state.stored.get(OFFLINE_CHECKIN_QUEUE_KEY) ?? "[]") as { lastError?: string }[];
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.lastError).toBe("timeout");

    const retryRun = await flushOfflineCheckins(accountId);
    expect(retryRun).toEqual({ synced: 2, remaining: 0 });
    expect(JSON.parse(state.stored.get(OFFLINE_CHECKIN_QUEUE_KEY) ?? "[]")).toEqual([]);
  });
});
