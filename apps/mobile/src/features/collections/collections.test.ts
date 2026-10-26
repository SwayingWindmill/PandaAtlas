import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ authedApi: {} }));

const { NAME_MAX, collectionName, sortCollections } = await import("./collections");
const { lastVisitByPlace, sortVisits } = await import("../visits/visits");

const collection = (name: string, updatedAt: string) => ({
  collectionId: name,
  name,
  pandaIds: [],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt,
});

const visit = (checkinId: string, placeId: string, visitedOn: string, createdAt = "2026-10-27T00:00:00.000Z") => ({
  checkinId,
  placeId,
  visitedOn,
  createdAt,
});

describe("collections", () => {
  it("puts the most recently changed collection first", () => {
    const sorted = sortCollections([
      collection("旧的", "2026-10-01T00:00:00Z"),
      collection("新的", "2026-10-27T00:00:00Z"),
    ]);
    expect(sorted.map((item) => item.name)).toEqual(["新的", "旧的"]);
  });

  it("accepts a trimmed name the API allows", () => {
    expect(collectionName("  最喜欢  ")).toBe("最喜欢");
    expect(collectionName("   ")).toBeNull();
    expect(collectionName("熊".repeat(NAME_MAX + 1))).toBeNull();
  });
});

describe("visits", () => {
  it("lists the latest day first and keeps the latest day per place", () => {
    const visits = [visit("a", "p1", "2026-05-01"), visit("b", "p1", "2026-10-27"), visit("c", "p2", "2026-07-01")];
    expect(sortVisits(visits).map((item) => item.checkinId)).toEqual(["b", "c", "a"]);
    expect(lastVisitByPlace(visits)).toEqual(
      new Map([
        ["p1", "2026-10-27"],
        ["p2", "2026-07-01"],
      ]),
    );
  });
});
