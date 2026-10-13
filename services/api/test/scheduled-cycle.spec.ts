import { describe, expect, it } from "vitest";

import { runScheduledCycle } from "../src/jobs/scheduled-cycle.js";

const effects = { publicCache: { purge: () => Promise.resolve() } };

function recordingLogger() {
  const entries: Array<{ level: string; message: string; fields: Record<string, unknown> | undefined }> = [];
  return {
    entries,
    write: (level: string, message: string, fields?: Record<string, unknown>) => {
      entries.push({ level, message, fields });
    },
  };
}

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

    const logger = recordingLogger();

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive", effects, logger)).resolves.toEqual({ audit: 1 });
    expect(calls).toEqual(["open:postgres://hyperdrive", "cycle", "close"]);
    expect(logger.entries).toEqual([
      { level: "info", message: "Async downstream cycle completed", fields: { stages: { audit: 1 } } },
    ]);
  });

  it("propagates a failed cycle so the scheduled invocation fails", async () => {
    const database = {
      withRequest: <T>(_connectionString: string, work: () => Promise<T>) => work(),
    };
    const runner = {
      runCycle: () => Promise.reject(new Error("outbox unavailable")),
    };

    const logger = recordingLogger();

    await expect(runScheduledCycle(database, runner, "postgres://hyperdrive", effects, logger)).rejects.toThrow("outbox unavailable");
    expect(logger.entries).toMatchObject([
      { level: "error", message: "Async downstream cycle failed", fields: { error: { name: "Error", message: "outbox unavailable" } } },
    ]);
  });
});
