import { describe, expect, it, vi } from "vitest";

import { withSearch, withView } from "./recent";

vi.mock("@/lib/api", () => ({ api: {} }));
vi.mock("@/lib/stored-pref", () => ({ createStoredPref: () => ({}) }));

describe("recent pandas and searches", () => {
  it("puts the newest view first and keeps one entry per panda", () => {
    expect(withView(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("keeps ten views", () => {
    const slugs = Array.from({ length: 10 }, (_, index) => `p${index}`);
    expect(withView(slugs, "new")).toEqual(["new", ...slugs.slice(0, 9)]);
  });

  it("treats searches that normalize alike as one", () => {
    expect(withSearch(["ml", "Fu Bao"], "fubao")).toEqual(["fubao", "ml"]);
  });

  it("keeps eight searches, newest first", () => {
    const queries = Array.from({ length: 8 }, (_, index) => `q${index}`);
    expect(withSearch(queries, " 萌兰 ")).toEqual(["萌兰", ...queries.slice(0, 7)]);
  });
});
