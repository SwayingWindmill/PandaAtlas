import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPandaIndex } from "@/features/pandas/pandas";
import { queryClient } from "@/lib/query-client";

const publicApi = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: publicApi,
}));

afterEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

describe("loadPandaIndex", () => {
  it("builds the panda index from /api/v2/pandas alone without separate residency or place requests", async () => {
    publicApi.GET.mockResolvedValueOnce({
      data: {
        items: [
          {
            pandaId: "p-1",
            canonicalSlug: "bao-li",
            legacySlugs: ["baoli"],
            names: [
              { languageTag: "zh-Hans", nameKind: "official", value: "宝力", isPrimary: true },
              { languageTag: "en", nameKind: "official", value: "Bao Li", isPrimary: true },
            ],
            facts: [
              {
                fieldKey: "sex",
                value: "male",
                status: "confirmed",
                lastVerifiedOn: "2026-10-28",
                conclusionVersion: 1,
              },
              {
                fieldKey: "birth_date",
                value: "2021-08-04",
                status: "confirmed",
                lastVerifiedOn: "2026-10-28",
                conclusionVersion: 1,
              },
            ],
            currentPlace: {
              placeId: "pl-dc",
              slug: "smithsonian-national-zoo",
              placeType: "facility",
              nameZh: "史密森国家动物园",
              countryCode: "US",
              region: "Washington, DC",
            },
            hasFullBleedCover: true,
          },
          {
            pandaId: "p-2",
            canonicalSlug: "fu-bao",
            legacySlugs: [],
            names: [{ languageTag: "zh-Hans", nameKind: "official", value: "福宝", isPrimary: true }],
            facts: [],
          },
        ],
      },
    });

    const items = await loadPandaIndex();

    expect(publicApi.GET).toHaveBeenCalledTimes(1);
    expect(publicApi.GET).toHaveBeenCalledWith("/api/v2/pandas");
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.id === "p-1")).toMatchObject({
      id: "p-1",
      slug: "bao-li",
      name: "宝力",
      sex: "male",
      birthDate: "2021-08-04",
      deceased: false,
      place: "史密森国家动物园",
      placeId: "pl-dc",
      area: "海外",
      hasFullBleedCover: true,
    });
    expect(items.find((item) => item.id === "p-1")?.terms).toContain("史密森国家动物园");
    expect(items.find((item) => item.id === "p-2")?.hasFullBleedCover).toBe(false);
    expect(items.find((item) => item.id === "p-2")?.placeId).toBeNull();
  });
});
