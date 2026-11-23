import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { failedWithoutData } from "./query-failed";

function observe(client: QueryClient, queryFn: () => Promise<string>) {
  return new QueryObserver(client, { queryKey: ["test"], queryFn, retry: false, staleTime: 0 });
}

describe("failedWithoutData", () => {
  it("keeps the data on screen when a background refetch fails", async () => {
    const client = new QueryClient();
    let fail = false;
    const observer = observe(client, async () => {
      if (fail) throw new Error("offline");
      return "loaded";
    });
    await observer.refetch();
    fail = true;
    await observer.refetch();

    const result = observer.getCurrentResult();
    expect(result.isError).toBe(true);
    expect(result.data).toBe("loaded");
    expect(failedWithoutData(result)).toBe(false);
  });

  it("fails when the first load fails and there is nothing to show", async () => {
    const observer = observe(new QueryClient(), async () => {
      throw new Error("offline");
    });
    await observer.refetch();
    expect(failedWithoutData(observer.getCurrentResult())).toBe(true);
  });

  it("does not fail while loading", () => {
    const observer = observe(new QueryClient(), () => new Promise<string>(() => {}));
    expect(failedWithoutData(observer.getCurrentResult())).toBe(false);
  });
});
