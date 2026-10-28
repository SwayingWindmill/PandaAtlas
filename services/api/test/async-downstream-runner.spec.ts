import { describe, expect, it } from "vitest";

import { AsyncDownstreamRunnerService } from "../src/jobs/async-downstream-runner.service.js";

const effects = { publicCache: { purge: () => Promise.resolve() } };

function stage(name: string, calls: string[], options: { fail?: boolean; received?: number; dispatched?: number } = {}) {
  return {
    processBatch: () => {
      calls.push(name);
      return options.fail
        ? Promise.reject(new Error(`${name} unavailable`))
        : Promise.resolve({ received: options.received ?? 0, selected: options.received ?? 0 });
    },
    dispatchBatch: () => {
      calls.push(name);
      return Promise.resolve({ dispatched: options.dispatched ?? 0, queueMessages: 0 });
    },
  };
}

function runner(failing: string | undefined, busy: { name: string; received?: number; dispatched?: number } | undefined = undefined) {
  const calls: string[] = [];
  const logs: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  let heartbeats = 0;
  const optionsFor = (name: string) => ({
    fail: failing === name,
    ...(busy?.name === name ? { received: busy.received, dispatched: busy.dispatched } : {}),
  });
  const service = new AsyncDownstreamRunnerService(
    stage("dispatch", calls, optionsFor("dispatch")) as never,
    stage("updates", calls, optionsFor("updates")) as never,
    stage("notification", calls, optionsFor("notification")) as never,
    stage("privacy", calls, optionsFor("privacy")) as never,
    stage("provider", calls, optionsFor("provider")) as never,
    stage("audit", calls, optionsFor("audit")) as never,
    stage("publicCache", calls, optionsFor("publicCache")) as never,
    { recordSuccess: () => { heartbeats += 1; return Promise.resolve(); } } as never,
    { write: (level: string, message: string, fields?: Record<string, unknown>) => { logs.push({ level, message, fields }); } },
  );
  return { service, calls, logs, heartbeats: () => heartbeats };
}

describe("AsyncDownstreamRunnerService", () => {
  it("records the heartbeat when every stage completes", async () => {
    const { service, calls, heartbeats } = runner(undefined);
    await expect(service.runCycle(effects)).resolves.toMatchObject({ audit: { received: 0 } });
    expect(calls).toEqual([
      "dispatch", "publicCache", "updates", "notification", "privacy", "provider", "audit",
    ]);
    expect(heartbeats()).toBe(1);
  });

  it("dispatches again only after a stage that can append outbox events", async () => {
    const { service, calls } = runner(undefined, { name: "updates", received: 2 });
    await service.runCycle(effects);
    expect(calls).toEqual([
      "dispatch", "publicCache", "updates", "dispatch", "notification", "privacy", "provider", "audit",
    ]);

    const followed = runner(undefined, { name: "notification", received: 1 });
    await followed.service.runCycle(effects);
    expect(followed.calls).toEqual([
      "dispatch", "publicCache", "updates", "notification", "privacy", "provider", "dispatch", "audit",
    ]);
  });

  it("runs every later stage when one fails, then fails the cycle without recording the heartbeat", async () => {
    const { service, calls, logs, heartbeats } = runner("publicCache");
    await expect(service.runCycle(effects)).rejects.toThrow("Async downstream stages failed: publicCache: publicCache unavailable");
    expect(calls).toEqual([
      "dispatch", "publicCache", "updates", "notification", "privacy", "provider", "audit",
    ]);
    expect(logs).toMatchObject([
      {
        level: "error",
        message: "Async downstream stage failed",
        fields: { stage: "publicCache", error: { message: "publicCache unavailable" } },
      },
    ]);
    expect(heartbeats()).toBe(0);
  });
});
