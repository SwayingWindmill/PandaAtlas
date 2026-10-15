import { describe, expect, it } from "vitest";

import { createColdStartReporter } from "../src/platform/observability/cold-start.js";

function recordingLogger() {
  const entries: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = [];
  return { entries, write: (level: string, message: string, fields?: Record<string, unknown>) => { entries.push({ level, message, fields }); } };
}

describe("createColdStartReporter", () => {
  it("logs the isolate's first invocation and nothing later", () => {
    const logger = recordingLogger();
    const reporter = createColdStartReporter(logger);

    reporter.report("fetch", { method: "GET", path: "/api/v2/pandas" });
    reporter.report("fetch", { method: "GET", path: "/health" });
    reporter.report("scheduled");

    expect(logger.entries).toEqual([
      {
        level: "info",
        message: "Worker started",
        fields: { coldStart: true, trigger: "fetch", method: "GET", path: "/api/v2/pandas" },
      },
    ]);
  });

  it("names a Cron Trigger as the first invocation without request fields", () => {
    const logger = recordingLogger();
    createColdStartReporter(logger).report("scheduled");
    expect(logger.entries[0]?.fields).toEqual({ coldStart: true, trigger: "scheduled" });
  });
});
