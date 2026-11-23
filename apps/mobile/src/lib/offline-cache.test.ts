import { describe, expect, it, vi } from "vitest";

import { clearOfflineCache } from "./offline-cache";

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getAllKeys: async () => [...stored.keys()],
    removeMany: async (keys: string[]) => keys.forEach((key) => stored.delete(key)),
  },
}));

describe("clearOfflineCache", () => {
  it("removes the saved public reads and keeps the fan's own settings", async () => {
    stored.set("offline:/api/v2/pandas", "[]");
    stored.set("offline:/api/v2/pandas/a-bao", "{}");
    stored.set("offline:pages", '["offline:/api/v2/pandas/a-bao"]');
    stored.set("welcome.seen", "1");
    stored.set("appearance", "dark");

    expect(await clearOfflineCache()).toBe(3);
    expect([...stored.keys()]).toEqual(["welcome.seen", "appearance"]);
  });

  it("reports nothing cleared when nothing was saved", async () => {
    stored.clear();
    expect(await clearOfflineCache()).toBe(0);
  });
});
