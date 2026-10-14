import type { AuditEventConsumerService } from "../modules/audit/infrastructure/audit-event-consumer.service.js";
import type { NotificationEventConsumerService } from "../modules/notification/infrastructure/notification-event-consumer.service.js";
import type { NotificationProviderWorkerService } from "../modules/notification/infrastructure/notification-provider-worker.service.js";
import type { PublicCachePort } from "../modules/publication/application/public-cache.port.js";
import type { PublicCacheConsumerService } from "../modules/publication/infrastructure/public-cache-consumer.service.js";
import type { PrivacyRequestProcessorService } from "../modules/privacy/infrastructure/privacy-request-processor.service.js";
import type { UpdatesEventConsumerService } from "../modules/updates/infrastructure/updates-event-consumer.service.js";
import type { AsyncDownstreamHeartbeat } from "../platform/integration/async-downstream-heartbeat.js";
import type { OutboxDispatcherService } from "../platform/integration/outbox-dispatcher.service.js";
import { serializeError, type StructuredLoggerService } from "../platform/observability/structured-logger.service.js";

// Effects that live outside the API and its database, bound per Worker invocation.
export interface AsyncDownstreamEffects {
  publicCache: PublicCachePort;
}

export class AsyncDownstreamRunnerService {
  public constructor(
    private readonly dispatcher: OutboxDispatcherService,
    private readonly updates: UpdatesEventConsumerService,
    private readonly notification: NotificationEventConsumerService,
    private readonly privacy: PrivacyRequestProcessorService,
    private readonly provider: NotificationProviderWorkerService,
    private readonly audit: AuditEventConsumerService,
    private readonly publicCache: PublicCacheConsumerService,
    private readonly heartbeat: AsyncDownstreamHeartbeat,
    private readonly logger: Pick<StructuredLoggerService, "write">,
  ) {}

  // Runs every stage even when an earlier one fails, so one broken stage cannot hold back the others.
  // The heartbeat records only a cycle in which every stage completed; a failed stage fails the cycle.
  public async runCycle(effects: AsyncDownstreamEffects) {
    const failures: Array<{ stage: string; error: unknown }> = [];
    const run = async <T>(stage: string, work: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await work();
      } catch (error) {
        this.logger.write("error", "Async downstream stage failed", { stage, error: serializeError(error) });
        failures.push({ stage, error });
        return undefined;
      }
    };

    const stages = {
      dispatchInitial: await run("dispatchInitial", () => this.dispatcher.dispatchBatch(50)),
      publicCache: await run("publicCache", () => this.publicCache.processBatch(effects.publicCache)),
      updates: await run("updates", () => this.updates.processBatch(25)),
      dispatchAfterUpdates: await run("dispatchAfterUpdates", () => this.dispatcher.dispatchBatch(50)),
      notification: await run("notification", () => this.notification.processBatch(25)),
      privacy: await run("privacy", () => this.privacy.processBatch(5)),
      provider: await run("provider", () => this.provider.processBatch(10)),
      dispatchFinal: await run("dispatchFinal", () => this.dispatcher.dispatchBatch(50)),
      audit: await run("audit", () => this.audit.processBatch(50)),
    };
    if (failures.length > 0) {
      const summary = failures
        .map(({ stage, error }) => `${stage}: ${error instanceof Error ? error.message : String(error)}`)
        .join("; ");
      throw new Error(`Async downstream stages failed: ${summary}`, { cause: failures[0]?.error });
    }
    await this.heartbeat.recordSuccess();
    return stages;
  }
}
