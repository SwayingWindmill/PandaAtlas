import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "@/lib/query-client";

import {
  GUEST_STORAGE_KEYS,
  createGuestCollection,
  deleteGuestCollection,
  guestCollectionsQueryKey,
  guestFavoritesQueryKey,
  loadGuestCollections,
  loadGuestFavorites,
  loadGuestFollowedVenues,
  loadGuestGames,
  loadGuestSeen,
  loadGuestVisits,
  pruneSyncedGuestData,
  readAllGuestData,
  recordGuestGame,
  recordGuestVisit,
  removeGuestVisit,
  renameGuestCollection,
  setGuestFollowing,
  setGuestFollowingVenue,
  setGuestSeen,
  setInGuestCollection,
} from "./guest-store";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));
vi.mock("@/lib/api", () => ({ authedApi: {} }));

beforeEach(() => {
  storage.clear();
  queryClient.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("guest-store", () => {
  it("uses zhipanda:guest: prefix rather than offline: so cache clears never wipe local records", () => {
    for (const key of Object.values(GUEST_STORAGE_KEYS)) {
      expect(key.startsWith("zhipanda:guest:")).toBe(true);
      expect(key.startsWith("offline:")).toBe(false);
    }
  });

  it("handles favorites, venues, and seen records cleanly", async () => {
    await setGuestFollowing("he-hua", true);
    await setGuestFollowing("meng-lan", true);
    await setGuestFollowing("he-hua", false);
    expect(await loadGuestFavorites()).toEqual(["meng-lan"]);
    expect(queryClient.getQueryData(guestFavoritesQueryKey)).toEqual(["meng-lan"]);

    await setGuestFollowingVenue("chengdu-research-base", true);
    await setGuestFollowingVenue("beijing-zoo", true);
    await setGuestFollowingVenue("chengdu-research-base", false);
    expect(await loadGuestFollowedVenues()).toEqual(["beijing-zoo"]);

    await setGuestSeen("meng-lan", "2026-11-23");
    const seen = await loadGuestSeen();
    expect(seen["meng-lan"]?.seenOn).toBe("2026-11-23");
    await setGuestSeen("meng-lan", null);
    expect(await loadGuestSeen()).toEqual({});
  });

  it("handles visits CRUD and sorts newest date first", async () => {
    const older = await recordGuestVisit("place-a", "2026-10-01");
    const newer = await recordGuestVisit("place-b", "2026-11-20");
    expect(older.checkinId.startsWith("local-visit-")).toBe(true);

    const list = await loadGuestVisits();
    expect(list.map((item) => item.checkinId)).toEqual([newer.checkinId, older.checkinId]);

    await removeGuestVisit(older.checkinId);
    expect((await loadGuestVisits()).map((item) => item.checkinId)).toEqual([newer.checkinId]);
  });

  it("handles collections CRUD, membership, and cache sync", async () => {
    const created = await createGuestCollection("三角饭团");
    expect(created.collectionId.startsWith("local-col-")).toBe(true);

    await setInGuestCollection(created.collectionId, "he-hua", true);
    await setInGuestCollection(created.collectionId, "he-hua", true);
    await setInGuestCollection(created.collectionId, "he-ye", true);
    const renamed = await renameGuestCollection(created.collectionId, "成都日常");
    expect(renamed.name).toBe("成都日常");
    expect(renamed.pandaIds).toEqual(["he-hua", "he-ye"]);

    await setInGuestCollection(created.collectionId, "he-ye", false);
    const current = await loadGuestCollections();
    expect(current[0]?.pandaIds).toEqual(["he-hua"]);
    expect(queryClient.getQueryData(guestCollectionsQueryKey)).toEqual(current);

    await deleteGuestCollection(created.collectionId);
    expect(await loadGuestCollections()).toEqual([]);

    await expect(renameGuestCollection("missing-id", "不会生效")).rejects.toThrow("Guest collection not found");
    const recovered = await createGuestCollection("失败后继续");
    expect(recovered.name).toBe("失败后继续");
  });

  it("tracks recognized games without double counting the same daily puzzle day", async () => {
    await recordGuestGame("he-hua", "daily_panda", "2026-11-23");
    await recordGuestGame("he-hua", "daily_panda", "2026-11-23");
    await recordGuestGame("he-hua", "guess_panda", "2026-11-23");
    const games = await loadGuestGames();
    expect(games).toEqual([{ pandaId: "he-hua", firstGame: "daily_panda", firstMetAt: "2026-11-23", timesMet: 2 }]);
  });

  it("recovers safely from corrupted storage payloads", async () => {
    for (const key of Object.values(GUEST_STORAGE_KEYS)) {
      storage.set(key, "{not valid json");
    }
    expect(await readAllGuestData()).toEqual({
      followedPandas: [],
      seenPandas: {},
      followedVenues: [],
      visits: [],
      collections: [],
      games: [],
    });
  });

  it("prunes only synced items and keeps unsynced or partially synced items intact", async () => {
    await setGuestFollowing("p1", true);
    await setGuestFollowing("p2", true);
    await setGuestSeen("s1", "2026-11-01");
    await setGuestSeen("s2", "2026-11-02");
    await setGuestFollowingVenue("v1", true);
    await setGuestFollowingVenue("v2", true);
    const visit1 = await recordGuestVisit("pl1", "2026-11-01");
    const visit2 = await recordGuestVisit("pl2", "2026-11-02");
    const colFull = await createGuestCollection("全部同步");
    await setInGuestCollection(colFull.collectionId, "p1", true);
    const colPartial = await createGuestCollection("部分同步");
    await setInGuestCollection(colPartial.collectionId, "p1", true);
    await setInGuestCollection(colPartial.collectionId, "p2", true);

    await pruneSyncedGuestData({
      followedPandas: new Set(["p1"]),
      seenPandaIds: new Set(["s1"]),
      followedVenues: new Set(["v1"]),
      visitIds: new Set([visit1.checkinId]),
      syncedCollections: new Map([
        [colFull.collectionId, new Set(["p1"])],
        [colPartial.collectionId, new Set(["p1"])],
      ]),
    });

    const left = await readAllGuestData();
    expect(left.followedPandas).toEqual(["p2"]);
    expect(Object.keys(left.seenPandas)).toEqual(["s2"]);
    expect(left.followedVenues).toEqual(["v2"]);
    expect(left.visits.map((item) => item.checkinId)).toEqual([visit2.checkinId]);
    expect(left.collections).toHaveLength(1);
    expect(left.collections[0]?.collectionId).toBe(colPartial.collectionId);
    expect(left.collections[0]?.pandaIds).toEqual(["p2"]);
  });
});
