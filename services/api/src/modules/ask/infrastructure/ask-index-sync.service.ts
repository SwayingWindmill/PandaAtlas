import { serializeError, type StructuredLoggerService } from "../../../platform/observability/structured-logger.service.js";
import type { AskIndexSync } from "../application/ask-index-sync.js";
import type { AskRuntimeService, AskWorkerBindings } from "./cloudflare-ask-runtime.js";

/** Brings the AI Search index in line with the published corpus during a Cron Trigger. */
export class AskIndexSyncService {
  public constructor(
    private readonly sync: AskIndexSync,
    private readonly runtime: AskRuntimeService,
    private readonly logger: Pick<StructuredLoggerService, "write">,
  ) {}

  // Never throws: a failed sync is retried next cycle and must not mark the cron run failed.
  public async run(bindings: AskWorkerBindings): Promise<void> {
    try {
      const result = await this.runtime.withBindings(bindings, async () => {
        const runtime = this.runtime.current();
        if (runtime === undefined) return undefined;
        return this.sync.run(runtime.index);
      });
      if (result === undefined) this.logger.write("warn", "Ask index sync skipped: AI bindings are missing");
      else this.logger.write("info", "Ask index sync finished", { askIndex: result });
    } catch (error) {
      this.logger.write("error", "Ask index sync failed", { error: serializeError(error) });
    }
  }
}
