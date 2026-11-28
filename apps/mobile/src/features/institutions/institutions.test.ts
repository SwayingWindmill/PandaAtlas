import { afterEach, describe, expect, it, vi } from "vitest";

import { seenIdsQueryOptions } from "@/features/engagement/seen";
import { institutionQueryOptions, loadInstitution } from "@/features/institutions/institutions";
import { queryClient } from "@/lib/query-client";

const publicApi = vi.hoisted(() => ({ GET: vi.fn() }));
const privateApi = vi.hoisted(() => ({ GET: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: publicApi,
  authedApi: privateApi,
}));

afterEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

describe("institution & seen query caching", () => {
  it("loads institution summary in one request and caches per slug", async () => {
    publicApi.GET.mockImplementation(async (path: string, init?: { params?: { path?: { slug?: string } } }) => {
      if (path === "/api/v2/institutions/{slug}") {
        const slug = init?.params?.path?.slug ?? "chengdu";
        return {
          data: {
            institution: {
              slug,
              nameZh: slug === "wolong" ? "卧龙基地" : "成都基地",
              nameEn: slug === "wolong" ? "Wolong Base" : "Chengdu Base",
              countryCode: "CN",
              profile: null,
            },
            places: [],
            residents: [
              {
                pandaId: "p-1",
                canonicalSlug: "hua-hua",
                legacySlugs: [],
                names: [{ languageTag: "zh-Hans", nameKind: "official", value: "和花", isPrimary: true }],
                facts: [{ fieldKey: "sex", value: "female", status: "confirmed", lastVerifiedOn: "2026-10-28", conclusionVersion: 1 }],
                hasFullBleedCover: true,
              },
            ],
            former: [
              {
                panda: {
                  pandaId: "p-2",
                  canonicalSlug: "mei-xiang",
                  legacySlugs: [],
                  names: [{ languageTag: "zh-Hans", nameKind: "official", value: "美香", isPrimary: true }],
                  facts: [],
                },
                fromYear: 2000,
                toYear: 2023,
                bornHere: true,
              },
            ],
            bornHereCount: 1,
          },
        };
      }
      return { data: undefined };
    });

    const first = await loadInstitution("chengdu");
    const second = await queryClient.fetchQuery(institutionQueryOptions("chengdu"));
    const other = await loadInstitution("wolong");
    expect(first.slug).toBe("chengdu");
    expect(first.residents.map((panda) => ({ id: panda.id, hasFullBleedCover: panda.hasFullBleedCover }))).toEqual([
      { id: "p-1", hasFullBleedCover: true },
    ]);
    expect(first.former).toMatchObject([{ from: 2000, to: 2023, bornHere: true, panda: { slug: "mei-xiang" } }]);
    expect(first.bornHere).toBe(1);
    expect(second.name).toBe("成都基地");
    expect(other.name).toBe("卧龙基地");

    expect(publicApi.GET).toHaveBeenCalledTimes(2);
    expect(publicApi.GET.mock.calls.every(([path]) => path === "/api/v2/institutions/{slug}")).toBe(true);
  });

  it("scopes seen-ids under the private query namespace", async () => {
    privateApi.GET.mockResolvedValueOnce({ data: { items: [{ pandaId: "p-1" }] } });
    const options = seenIdsQueryOptions("alice");
    const ids = await queryClient.fetchQuery(options);
    expect([...ids]).toEqual(["p-1"]);
    expect(queryClient.getQueryData(["private", "alice", "seen-ids"])).toBeDefined();

    queryClient.removeQueries({ queryKey: ["private"] });
    expect(queryClient.getQueryData(["private", "alice", "seen-ids"])).toBeUndefined();
  });
});
