import { describe, expect, it, vi } from "vitest";

import { parseList, recordSearch, recordView, withSearch, withView } from "./recent";

const disk = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/api", () => ({ api: {} }));
vi.mock("@/lib/stored-pref", async () => {
  const { createStoredPrefStore } = await import("@/lib/stored-pref-store");
  const storage = {
    getItem: async (key: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return disk.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => void disk.set(key, value),
  };
  return { createStoredPref: (options: Parameters<typeof createStoredPrefStore>[1]) => createStoredPrefStore(storage, options) };
});

const saved = async (key: string) => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return JSON.parse(disk.get(key) ?? "[]") as string[];
};

describe("recent pandas and searches", () => {
  it("puts the newest view first and keeps one entry per panda", () => {
    expect(withView(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("keeps ten views", () => {
    const ids = Array.from({ length: 10 }, (_, index) => `p${index}`);
    expect(withView(ids, "new")).toEqual(["new", ...ids.slice(0, 9)]);
  });

  it("treats searches that normalize alike as one", () => {
    expect(withSearch(["ml", "Fu Bao"], "fubao")).toEqual(["fubao", "ml"]);
  });

  it("keeps eight searches, newest first", () => {
    const queries = Array.from({ length: 8 }, (_, index) => `q${index}`);
    expect(withSearch(queries, " 萌兰 ")).toEqual(["萌兰", ...queries.slice(0, 7)]);
  });

  it("cuts a long query to 32 characters", () => {
    expect(withSearch([], "a".repeat(100))[0]).toHaveLength(32);
  });

  it("cleans stored text: no blanks, no repeats, no non-strings, cut to length and count", () => {
    const stored = JSON.stringify(["a", "", "  ", "a", 7, null, "b".repeat(50), "c", "d"]);
    expect(parseList(3, 32)(stored)).toEqual(["a", "b".repeat(32), "c"]);
    expect(parseList(3, 32)("not json")).toEqual([]);
    expect(parseList(3, 32)('{"a":1}')).toEqual([]);
  });

  it("keeps both views when two are recorded at once", async () => {
    await Promise.all([recordView("first"), recordView("second")]);
    expect(await saved("recentPandaViews")).toEqual(["second", "first"]);
  });

  it("keeps both searches when two are recorded at once", async () => {
    await Promise.all([recordSearch("ml"), recordSearch("hh"), recordSearch("   ")]);
    expect(await saved("recentPandaSearches")).toEqual(["hh", "ml"]);
  });
});
