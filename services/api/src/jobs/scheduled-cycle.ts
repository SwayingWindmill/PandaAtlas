import type { DatabaseService } from "../platform/database/database.service.js";
import type { AsyncDownstreamRunnerService } from "./async-downstream-runner.service.js";

// One Cron Trigger invocation runs exactly one bounded cycle in a request-scoped Hyperdrive pool.
// A rejected cycle propagates so Cloudflare records the scheduled invocation as failed.
export function runScheduledCycle(
  database: Pick<DatabaseService, "withRequest">,
  runner: Pick<AsyncDownstreamRunnerService, "runCycle">,
  connectionString: string,
) {
  return database.withRequest(connectionString, () => runner.runCycle());
}
