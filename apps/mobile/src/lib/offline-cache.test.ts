import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OFFLINE_PACKS_KEY,
  clearOfflineCache,
  flushOfflineCacheWrites,
  getPinnedOfflineKeys,
  offlineCache,
  registerOfflineCacheReset,
} from "./offline-cache";

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
    getAllKeys: async () => [...stored.keys()],
    removeMany: async (keys: string[]) => keys.forEach((key) => stored.delete(key)),
  },
}));

describe("offlineCache", () => {
  beforeEach(() => {
    stored.clear();
  });

  it("removes saved public reads while keeping user settings and offline check-in queue", async () => {
    stored.set("offline:/api/v2/pandas", "[]");
    stored.set("offline:/api/v2/pandas/a-bao", "{}");
    stored.set("offline:pages", '["offline:/api/v2/pandas/a-bao"]');
    stored.set("offline-checkin-queue:v1", '[{"placeId":"p1"}]');
    stored.set("welcome.seen", "1");
    stored.set("appearance", "dark");

    const reset = vi.fn();
    const unregister = registerOfflineCacheReset(reset);
    try {
      expect(await clearOfflineCache()).toBe(3);
      expect(reset).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
    expect([...stored.keys()]).toEqual(["offline-checkin-queue:v1", "welcome.seen", "appearance"]);
  });

  it("reports nothing cleared when nothing was saved", async () => {
    expect(await clearOfflineCache()).toBe(0);
  });

  it("keeps pinned base-pack pages when unpinned reads overflow the 30-page LRU window", async () => {
    const pinnedKey = "offline:/api/v2/pandas/he-hua-chengdu";
    stored.set(
      OFFLINE_PACKS_KEY,
      JSON.stringify({
        "chengdu-research-base": {
          pinnedKeys: [pinnedKey, "offline:/api/v2/institutions/chengdu-research-base"],
        },
      }),
    );
    expect([...(await getPinnedOfflineKeys())]).toContain(pinnedKey);

    await offlineCache.onResponse({
      request: new Request("https://api.zhipanda.com/api/v2/pandas/he-hua-chengdu"),
      response: new Response(JSON.stringify({ slug: "he-hua-chengdu" }), { status: 200 }),
    });
    for (let i = 0; i < 35; i += 1) {
      await offlineCache.onResponse({
        request: new Request(`https://api.zhipanda.com/api/v2/pandas/unpinned-${i}`),
        response: new Response(JSON.stringify({ slug: `unpinned-${i}` }), { status: 200 }),
      });
    }
    await flushOfflineCacheWrites();

    expect(stored.has(pinnedKey)).toBe(true);
    const offlineAnswer = await offlineCache.onError({
      request: new Request("https://api.zhipanda.com/api/v2/pandas/he-hua-chengdu"),
    });
    expect(offlineAnswer?.status).toBe(200);
    expect(await offlineAnswer?.json()).toEqual({ slug: "he-hua-chengdu" });
    expect(stored.has("offline:/api/v2/pandas/unpinned-0")).toBe(false);
    expect(stored.has("offline:/api/v2/pandas/unpinned-34")).toBe(true);
  });
});
