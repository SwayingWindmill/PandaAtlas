import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPandaChoices } from "./daily-panda";

const publicApi = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  api: publicApi,
  authedApi: { POST: vi.fn() },
  publicMediaUrl: (key: string) => key,
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("loadPandaChoices", () => {
  it("preserves hasFullBleedCover from /api/v2/pandas so the finished card loads curated hero photos", async () => {
    publicApi.GET.mockResolvedValueOnce({
      data: {
        items: [
          {
            pandaId: "p-1",
            canonicalSlug: "bao-li",
            legacySlugs: [],
            names: [{ languageTag: "zh-Hans", nameKind: "official", value: "宝力", isPrimary: true }],
            facts: [],
            hasFullBleedCover: true,
          },
          {
            pandaId: "p-2",
            canonicalSlug: "other",
            legacySlugs: [],
            names: [{ languageTag: "en", nameKind: "official", value: "Other", isPrimary: true }],
            facts: [],
          },
        ],
      },
    });

    await expect(loadPandaChoices()).resolves.toEqual([
      { id: "p-1", slug: "bao-li", name: "宝力", alternateName: null, hasFullBleedCover: true },
      { id: "p-2", slug: "other", name: "Other", alternateName: null, hasFullBleedCover: false },
    ]);
  });
});
