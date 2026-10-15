import type { StructuredLoggerService } from "./structured-logger.service.js";

export type WorkerTrigger = "fetch" | "scheduled";

// One entry per isolate, on its first invocation (#637). Workers Logs then show how often a cold
// start happens, and the `wallTimeMs` of the invocations carrying `coldStart: true` against the
// others shows what it costs. The isolate cannot time its own startup: Workers freeze the clock
// until a request performs I/O, so `Date.now()` reads the same value before and after bootstrap.
export function createColdStartReporter(logger: Pick<StructuredLoggerService, "write">) {
  let reported = false;
  return {
    report(trigger: WorkerTrigger, request?: { method: string; path: string }): void {
      if (reported) return;
      reported = true;
      logger.write("info", "Worker started", { coldStart: true, trigger, ...(request ?? {}) });
    },
  };
}
