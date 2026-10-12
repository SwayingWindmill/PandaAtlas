import { describe, expect, it } from "vitest";

import { runScheduledCycle } from "../src/jobs/scheduled-cycle.js";

describe("runScheduledCycle", () => {
  it("runs one runner cycle inside the request-scoped database context", async () => {
    const calls: string[] = [];
    const database = {
      withRequest: async <T>(connectionString: string, work: () => Promise<T>) => {
        calls.push(`open:${connectionString}`);
        try {
          return await work();
        } finally {
          calls.push("close");
        }
      },
    };
    const runner = {
      runCycle: () => {
        calls.push("cycle");
        return Promise.resolve({ audit: 1 } as never);
      },
    };

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive")).resolves.toEqual({ audit: 1 });
    expect(calls).toEqual(["open:postgres://hyperdrive", "cycle", "close"]);
  });

  it("propagates a failed cycle so the scheduled invocation fails", async () => {
    const database = {
      withRequest: <T>(_connectionString: string, work: () => Promise<T>) => work(),
    };
    const runner = {
      runCycle: () => Promise.reject(new Error("outbox unavailable")),
    };

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive")).rejects.toThrow("outbox unavailable");
  });
});
