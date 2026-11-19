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
  it("reuses shared residencies and caches institution details per slug", async () => {
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
          },
        };
      }
      if (path === "/api/v2/residencies") {
        return { data: { items: [] } };
      }
      if (path === "/api/v2/pandas") {
        return { data: { items: [] } };
      }
      if (path === "/api/v2/places") {
        return { data: { items: [] } };
      }
      return { data: undefined };
    });

    const first = await loadInstitution("chengdu");
    const second = await queryClient.fetchQuery(institutionQueryOptions("chengdu"));
    const other = await loadInstitution("wolong");
    expect(first.slug).toBe("chengdu");
    expect(second.name).toBe("成都基地");
    expect(other.name).toBe("卧龙基地");

    const institutionFetches = publicApi.GET.mock.calls.filter(([p]) => p === "/api/v2/institutions/{slug}");
    const residencyFetches = publicApi.GET.mock.calls.filter(([p]) => p === "/api/v2/residencies");
    expect(institutionFetches).toHaveLength(2);
    expect(residencyFetches).toHaveLength(1);
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
