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
    const alerts: Array<Record<string, unknown>> = [];

    await expect(
      runScheduledCycle(database, runner, "postgres://hyperdrive", effects, logger, {
        notify: (event) => {
          alerts.push(event as unknown as Record<string, unknown>);
          return Promise.resolve();
        },
      }),
    ).resolves.toEqual({ audit: 1 });
    expect(calls).toEqual(["open:postgres://hyperdrive", "cycle", "close"]);
    expect(logger.entries).toEqual([
      { level: "info", message: "Async downstream cycle completed", fields: { stages: { audit: 1 } } },
    ]);
    expect(alerts).toEqual([]);
  });

  it("propagates a failed cycle so the scheduled invocation fails", async () => {
    const database = {
      withRequest: <T>(_connectionString: string, work: () => Promise<T>) => work(),
    };
    const runner = {
      runCycle: () => Promise.reject(new Error("outbox unavailable")),
    };

    const logger = recordingLogger();
    const alerts: Array<Record<string, unknown>> = [];

    await expect(
      runScheduledCycle(database, runner, "postgres://hyperdrive", effects, logger, {
        notify: (event) => {
          alerts.push(event as unknown as Record<string, unknown>);
          return Promise.resolve();
        },
      }),
    ).rejects.toThrow("outbox unavailable");
    expect(logger.entries).toMatchObject([
      { level: "error", message: "Async downstream cycle failed", fields: { error: { name: "Error", message: "outbox unavailable" } } },
    ]);
    expect(alerts).toEqual([
      {
        severity: "critical",
        category: "cron_failure",
        title: "定时任务执行失败",
        summary: "Async downstream cycle failed (Error)",
        dedupeKey: "cron:async_downstream_cycle",
        cooldownMs: 300_000,
        metadata: { errorName: "Error" },
      },
    ]);
  });
});
