import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ authedApi: {} }));

const { NAME_MAX, collectionName, collectionsQueryKey, patchCollections, sortCollections } = await import("./collections");
const { queryClient } = await import("@/lib/query-client");
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

describe("patchCollections", () => {
  it("keeps a change that landed while an older fetch was still in flight", async () => {
    const key = collectionsQueryKey("account-1");
    const old = collection("旧名", "2026-10-01T00:00:00Z");
    queryClient.setQueryData(key, [old]);

    let finish: (value: (typeof old)[]) => void = () => {};
    const refetch = queryClient.fetchQuery({
      queryKey: key,
      queryFn: () => new Promise<(typeof old)[]>((resolve) => (finish = resolve)),
      staleTime: 0,
    });

    await patchCollections("account-1", (current) => current.map((item) => ({ ...item, name: "新名" })));
    finish([old]);
    await refetch;

    expect(queryClient.getQueryData<(typeof old)[]>(key)?.[0]?.name).toBe("新名");
    queryClient.clear();
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
