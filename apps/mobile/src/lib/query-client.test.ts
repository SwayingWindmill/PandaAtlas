import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyManager, onlineManager } from "@tanstack/react-query";

import { queryClient } from "./query-client";

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe("mobile query cache", () => {
  it("deduplicates concurrent reads and reuses fresh data", async () => {
    const load = vi.fn(async () => ({ name: "宝宝" }));
    const options = { queryKey: ["test", "family"], queryFn: load, staleTime: 300_000 } as const;
    const [first, second] = await Promise.all([queryClient.fetchQuery(options), queryClient.fetchQuery(options)]);
    expect(first).toEqual(second);
    await queryClient.fetchQuery(options);
    expect(load).toHaveBeenCalledTimes(1);
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
    await queryClient.fetchQuery(options);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("allows public reads to reach the existing offline fallback", async () => {
    onlineManager.setOnline(false);
    const load = vi.fn(async () => "saved public data");
    const result = await queryClient.fetchQuery({ queryKey: ["test", "offline"], queryFn: load, networkMode: "always" });
    expect(result).toBe("saved public data");
  });

  it("tells React about every query that settled in the same tick in one task", () => {
    vi.useFakeTimers();
    const order: string[] = [];
    for (const name of ["a", "b", "c"]) notifyManager.schedule(() => order.push(name));
    expect(vi.getTimerCount()).toBe(1);
    vi.runOnlyPendingTimers();
    expect(order).toEqual(["a", "b", "c"]);

    notifyManager.schedule(() => order.push("d"));
    expect(vi.getTimerCount()).toBe(1);
    vi.runOnlyPendingTimers();
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("still runs the rest of the task when one listener throws", () => {
    vi.useFakeTimers();
    const ran = vi.fn();
    const thrown: unknown[] = [];
    const microtask = vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => {
      try {
        callback();
      } catch (error) {
        thrown.push(error);
      }
    });
    notifyManager.schedule(() => {
      throw new Error("listener failed");
    });
    notifyManager.schedule(ran);
    vi.runOnlyPendingTimers();
    microtask.mockRestore();
    expect(ran).toHaveBeenCalledTimes(1);
    expect(thrown).toEqual([new Error("listener failed")]);
  });
});
