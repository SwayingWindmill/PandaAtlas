import { describe, expect, it } from "vitest";

import { AsyncDownstreamRunnerService } from "../src/jobs/async-downstream-runner.service.js";

const effects = { publicCache: { purge: () => Promise.resolve() } };

function stage(name: string, calls: string[], fail = false) {
  return {
    processBatch: () => {
      calls.push(name);
      return fail ? Promise.reject(new Error(`${name} unavailable`)) : Promise.resolve({ received: 0 });
    },
    dispatchBatch: () => {
      calls.push(name);
      return Promise.resolve({ dispatched: 0, queueMessages: 0 });
    },
  };
}

function runner(failing: string | undefined) {
  const calls: string[] = [];
  let heartbeats = 0;
  const service = new AsyncDownstreamRunnerService(
    stage("dispatch", calls) as never,
    stage("updates", calls, failing === "updates") as never,
    stage("notification", calls, failing === "notification") as never,
    stage("privacy", calls, failing === "privacy") as never,
    stage("provider", calls, failing === "provider") as never,
    stage("audit", calls, failing === "audit") as never,
    stage("publicCache", calls, failing === "publicCache") as never,
    { recordSuccess: () => { heartbeats += 1; return Promise.resolve(); } } as never,
  );
  return { service, calls, heartbeats: () => heartbeats };
}

describe("AsyncDownstreamRunnerService", () => {
  it("records the heartbeat when every stage completes", async () => {
    const { service, calls, heartbeats } = runner(undefined);
    await expect(service.runCycle(effects)).resolves.toMatchObject({ audit: { received: 0 } });
    expect(calls).toEqual([
      "dispatch", "publicCache", "updates", "dispatch", "notification", "privacy", "provider", "dispatch", "audit",
    ]);
    expect(heartbeats()).toBe(1);
  });

  it("runs every later stage when one fails, then fails the cycle without recording the heartbeat", async () => {
    const { service, calls, heartbeats } = runner("publicCache");
    await expect(service.runCycle(effects)).rejects.toThrow("Async downstream stages failed: publicCache: publicCache unavailable");
    expect(calls).toEqual([
      "dispatch", "publicCache", "updates", "dispatch", "notification", "privacy", "provider", "dispatch", "audit",
    ]);
    expect(heartbeats()).toBe(0);
  });
});
