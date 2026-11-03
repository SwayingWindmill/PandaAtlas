import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/query-client";
import { setFollowing } from "./favorites";

const api = vi.hoisted(() => ({
  POST: vi.fn(),
  DELETE: vi.fn(),
  GET: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ authedApi: api }));
vi.mock("@/features/session/session", () => ({ useSession: vi.fn() }));

afterEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
});

describe("favorites cache", () => {
  it("keeps accounts isolated and rolls back only the failed follow", async () => {
    queryClient.setQueryData(["private", "alice", "favorites"], ["existing"]);
    queryClient.setQueryData(["private", "bob", "favorites"], ["other"]);
    api.POST.mockResolvedValueOnce({ response: { ok: true } }).mockResolvedValueOnce({ response: { ok: false } });
    const results = await Promise.all([
      setFollowing("alice", "success", true),
      setFollowing("alice", "failure", true),
    ]);
    expect(results).toEqual([true, false]);
    expect(queryClient.getQueryData(["private", "alice", "favorites"])).toEqual(["existing", "success"]);
    expect(queryClient.getQueryData(["private", "bob", "favorites"])).toEqual(["other"]);
  });
});
