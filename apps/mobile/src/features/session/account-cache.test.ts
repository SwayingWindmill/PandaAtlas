import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_ACCOUNT_CACHE_KEY,
  clearCachedAccountId,
  readCachedAccountId,
  writeCachedAccountId,
} from "./account-cache";

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      stored.set(key, value);
    },
    removeMany: async (keys: string[]) => keys.forEach((key) => stored.delete(key)),
  },
}));

describe("account-cache", () => {
  beforeEach(() => {
    stored.clear();
  });

  it("uses a storage key outside the offline:* read cache namespace", () => {
    expect(SESSION_ACCOUNT_CACHE_KEY.startsWith("offline:")).toBe(false);
  });

  it("returns the cached accountId for matching userId and null for other users", async () => {
    await writeCachedAccountId("supa-user-1", "acc-1");
    expect(await readCachedAccountId("supa-user-1")).toBe("acc-1");
    expect(await readCachedAccountId("supa-user-2")).toBeNull();
  });

  it("returns null on malformed or incomplete stored payloads", async () => {
    stored.set(SESSION_ACCOUNT_CACHE_KEY, "{not-json");
    expect(await readCachedAccountId("supa-user-1")).toBeNull();

    stored.set(SESSION_ACCOUNT_CACHE_KEY, JSON.stringify({ userId: "supa-user-1" }));
    expect(await readCachedAccountId("supa-user-1")).toBeNull();
  });

  it("clears stored mapping cleanly on clearCachedAccountId", async () => {
    await writeCachedAccountId("supa-user-1", "acc-1");
    await clearCachedAccountId();
    expect(await readCachedAccountId("supa-user-1")).toBeNull();
  });
});
