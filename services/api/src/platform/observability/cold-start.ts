import type { StructuredLoggerService } from "./structured-logger.service.js";

export type WorkerTrigger = "fetch" | "scheduled";

// One entry per isolate, on its first invocation (#637); docs/deployment/runtime-status.md says how
// Workers Logs turn it into a cold-start rate and cost. The isolate carries no startup durations:
// Date.now() advances only when a request performs I/O, so module evaluation and bootstrap read
// the same clock value. https://developers.cloudflare.com/workers/reference/security-model/
export function createColdStartReporter(logger: Pick<StructuredLoggerService, "write">) {
  let reported = false;
  return {
    report(trigger: WorkerTrigger, request?: { method: string; path: string }): void {
      if (reported) return;
      reported = true;
      logger.write("info", "Worker started", { coldStart: true, trigger, ...request });
    },
  };
}
