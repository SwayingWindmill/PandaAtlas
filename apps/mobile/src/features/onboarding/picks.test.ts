import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearPicks, pickedPandas, readPicks, savePicks } from "./picks";

const stored = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => stored.get(key) ?? null,
    setItem: async (key: string, value: string) => void stored.set(key, value),
    removeItem: async (key: string) => void stored.delete(key),
  },
}));

beforeEach(() => stored.clear());

describe("welcome picks", () => {
  it("come back as saved, and are gone once cleared", async () => {
    await savePicks({ pandaIds: ["a", "b"], followAfterSignIn: true });
    expect(await readPicks()).toEqual({ pandaIds: ["a", "b"], followAfterSignIn: true });
    await clearPicks();
    expect(await readPicks()).toBeNull();
  });

  it("read as none when the stored value is not picks", async () => {
    stored.set("welcome.picks", "not json");
    expect(await readPicks()).toBeNull();
    stored.set("welcome.picks", JSON.stringify({ pandaIds: "a" }));
    expect(await readPicks()).toBeNull();
  });
});

describe("pickedPandas", () => {
  it("keeps the pick order and drops pandas no longer published", () => {
    const pandas = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(pickedPandas(pandas, ["c", "gone", "a"])).toEqual([{ id: "c" }, { id: "a" }]);
  });
});
