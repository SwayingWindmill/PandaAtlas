import { describe, expect, it } from "vitest";

import { runScheduledCycle } from "../src/jobs/scheduled-cycle.js";

const effects = { publicCache: { purge: () => Promise.resolve() } };

describe("runScheduledCycle", () => {
  it("runs one runner cycle with the invocation's effects inside the request-scoped database context", async () => {
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
      runCycle: (received: typeof effects) => {
        calls.push(received === effects ? "cycle" : "cycle without effects");
        return Promise.resolve({ audit: 1 } as never);
      },
    };

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive", effects)).resolves.toEqual({ audit: 1 });
    expect(calls).toEqual(["open:postgres://hyperdrive", "cycle", "close"]);
  });

  it("propagates a failed cycle so the scheduled invocation fails", async () => {
    const database = {
      withRequest: <T>(_connectionString: string, work: () => Promise<T>) => work(),
    };
    const runner = {
      runCycle: () => Promise.reject(new Error("outbox unavailable")),
    };

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive", effects)).rejects.toThrow("outbox unavailable");
  });
});
