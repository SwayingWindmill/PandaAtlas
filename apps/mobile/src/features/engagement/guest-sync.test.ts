import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryClient } from "@/lib/query-client";

import {
  createGuestCollection,
  readAllGuestData,
  recordGuestVisit,
  setGuestFollowing,
  setGuestFollowingVenue,
  setGuestSeen,
  setInGuestCollection,
} from "./guest-store";
import { syncGuestToAccount } from "./guest-sync";

const storage = vi.hoisted(() => new Map<string, string>());
const api = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
}));

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
vi.mock("@/lib/api", () => ({ authedApi: api }));

beforeEach(() => {
  storage.clear();
  queryClient.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("syncGuestToAccount", () => {
  it("skips network requests when guest storage is empty", async () => {
    await syncGuestToAccount("acc-1");
    expect(api.GET).not.toHaveBeenCalled();
    expect(api.POST).not.toHaveBeenCalled();
    expect(api.PUT).not.toHaveBeenCalled();
  });

  it("uploads all guest records cleanly and removes synced items", async () => {
    await setGuestFollowing("p1", true);
    await setGuestSeen("p1", "2026-11-23");
    await setGuestFollowingVenue("chengdu-research-base", true);
    await recordGuestVisit("place-1", "2026-11-23");
    const col = await createGuestCollection("我的必看");
    await setInGuestCollection(col.collectionId, "p1", true);

    api.POST.mockImplementation(async (path: string) => {
      if (path === "/api/v2/me/collections") {
        return { response: { ok: true }, data: { collectionId: "remote-col-1", name: "我的必看", pandaIds: [] } };
      }
      return { response: { ok: true }, data: {} };
    });
    api.PUT.mockResolvedValue({ response: { ok: true }, data: {} });
    api.GET.mockImplementation(async (path: string) => {
      if (path === "/api/v2/me/checkins" || path === "/api/v2/me/collections") {
        return { response: { ok: true }, data: { items: [] } };
      }
      return { response: { ok: false } };
    });

    await syncGuestToAccount("acc-1");

    expect(api.POST).toHaveBeenCalledWith("/api/v2/me/favorites/{pandaId}", { params: { path: { pandaId: "p1" } } });
    expect(api.PUT).toHaveBeenCalledWith("/api/v2/me/seen-pandas/{pandaId}", {
      params: { path: { pandaId: "p1" } },
      body: { seenOn: "2026-11-23", placeId: null },
    });
    expect(api.POST).toHaveBeenCalledWith("/api/v2/me/followed-venues/{slug}", {
      params: { path: { slug: "chengdu-research-base" } },
    });
    expect(api.POST).toHaveBeenCalledWith("/api/v2/me/checkins", {
      body: { placeId: "place-1", visitedOn: "2026-11-23" },
    });
    expect(api.POST).toHaveBeenCalledWith("/api/v2/me/collections/{collectionId}/pandas/{pandaId}", {
      params: { path: { collectionId: "remote-col-1", pandaId: "p1" } },
    });

    const remaining = await readAllGuestData();
    expect(remaining).toEqual({
      followedPandas: [],
      seenPandas: {},
      followedVenues: [],
      visits: [],
      collections: [],
      games: [],
    });
  });

  it("keeps failed items on the device so nothing is dropped", async () => {
    await setGuestFollowing("ok-panda", true);
    await setGuestFollowing("fail-panda", true);
    await setGuestSeen("seen-fail", "2026-11-20");
    const col = await createGuestCollection("双熊");
    await setInGuestCollection(col.collectionId, "ok-panda", true);
    await setInGuestCollection(col.collectionId, "fail-panda", true);

    api.POST.mockImplementation(async (path: string, opts?: { params?: { path?: { pandaId?: string } } }) => {
      if (path === "/api/v2/me/collections") {
        return { response: { ok: true }, data: { collectionId: "remote-col-2", name: "双熊", pandaIds: [] } };
      }
      const pandaId = opts?.params?.path?.pandaId;
      return { response: { ok: pandaId === "ok-panda" } };
    });
    api.PUT.mockResolvedValue({ response: { ok: false } });
    api.GET.mockResolvedValue({ response: { ok: true }, data: { items: [] } });

    await syncGuestToAccount("acc-1");

    const remaining = await readAllGuestData();
    expect(remaining.followedPandas).toEqual(["fail-panda"]);
    expect(Object.keys(remaining.seenPandas)).toEqual(["seen-fail"]);
    expect(remaining.collections).toHaveLength(1);
    expect(remaining.collections[0]?.pandaIds).toEqual(["fail-panda"]);
  });
});
