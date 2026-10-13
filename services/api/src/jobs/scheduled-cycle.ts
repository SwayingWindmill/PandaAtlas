import type { DatabaseService } from "../platform/database/database.service.js";
import { serializeError, type StructuredLoggerService } from "../platform/observability/structured-logger.service.js";
import type { AsyncDownstreamEffects, AsyncDownstreamRunnerService } from "./async-downstream-runner.service.js";

// One Cron Trigger invocation runs exactly one bounded cycle in a request-scoped Hyperdrive pool.
// The outcome is logged; a rejected cycle still propagates so Cloudflare records the scheduled
// invocation as failed.
export async function runScheduledCycle(
  database: Pick<DatabaseService, "withRequest">,
  runner: Pick<AsyncDownstreamRunnerService, "runCycle">,
  connectionString: string,
  effects: AsyncDownstreamEffects,
  logger: Pick<StructuredLoggerService, "write">,
) {
  try {
    const stages = await database.withRequest(connectionString, () => runner.runCycle(effects));
    logger.write("info", "Async downstream cycle completed", { stages });
    return stages;
  } catch (error) {
    logger.write("error", "Async downstream cycle failed", { error: serializeError(error) });
    throw error;
  }
}
