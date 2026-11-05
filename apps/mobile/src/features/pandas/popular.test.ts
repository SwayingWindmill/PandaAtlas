import { describe, expect, it, vi } from "vitest";

import type { PandaListItem } from "@/features/pandas/pandas";

import { popularRows } from "./popular";

vi.mock("@/lib/api", () => ({ api: {} }));

const panda = (slug: string) => ({ id: slug, slug }) as unknown as PandaListItem;

describe("popularRows", () => {
  it("keeps the API's order, drops slugs the index lacks, shows five at most", () => {
    const pandas = ["a", "b", "c", "d", "e", "f", "g"].map(panda);
    expect(popularRows(["g", "x", "a", "b", "c", "d", "e"], pandas).map((row) => row.slug)).toEqual(["g", "a", "b", "c", "d"]);
  });

  it("is empty when nobody reaches the floor", () => {
    expect(popularRows([], [panda("a")])).toEqual([]);
  });
});
