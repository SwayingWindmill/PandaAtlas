import type { AuditEventConsumerService } from "../modules/audit/infrastructure/audit-event-consumer.service.js";
import type { NotificationEventConsumerService } from "../modules/notification/infrastructure/notification-event-consumer.service.js";
import type { NotificationProviderWorkerService } from "../modules/notification/infrastructure/notification-provider-worker.service.js";
import type { PublicCachePort } from "../modules/publication/application/public-cache.port.js";
import type { PublicCacheConsumerService } from "../modules/publication/infrastructure/public-cache-consumer.service.js";
import type { PrivacyRequestProcessorService } from "../modules/privacy/infrastructure/privacy-request-processor.service.js";
import type { UpdatesEventConsumerService } from "../modules/updates/infrastructure/updates-event-consumer.service.js";
import type { AsyncDownstreamHeartbeat } from "../platform/integration/async-downstream-heartbeat.js";
import type { OutboxDispatchResult, OutboxDispatcherService } from "../platform/integration/outbox-dispatcher.service.js";
import { serializeError, type StructuredLoggerService } from "../platform/observability/structured-logger.service.js";

const IDLE_DISPATCH: OutboxDispatchResult = { dispatched: 0, queueMessages: 0 };

function stageProducedWork(result: unknown): boolean {
  if (result === undefined || result === null || typeof result !== "object") return false;
  const record = result as { received?: number; selected?: number };
  return (record.received ?? 0) > 0 || (record.selected ?? 0) > 0;
}

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

    const failed = (stage: string) => failures.some((failure) => failure.stage === stage);
    const dispatchInitial = await run("dispatchInitial", () => this.dispatcher.dispatchBatch(50));
    const publicCache = await run("publicCache", () => this.publicCache.processBatch(effects.publicCache));
    const updates = await run("updates", () => this.updates.processBatch(25));
    // Later dispatches only publish events the stage that just ran appended.
    // An idle cycle would otherwise open a transaction for an empty outbox twice more.
    const dispatchAfterUpdates = stageProducedWork(updates) || failed("updates")
      ? await run("dispatchAfterUpdates", () => this.dispatcher.dispatchBatch(50))
      : IDLE_DISPATCH;
    const notification = await run("notification", () => this.notification.processBatch(25));
    const privacy = await run("privacy", () => this.privacy.processBatch(5));
    const provider = await run("provider", () => this.provider.processBatch(10));
    const dispatchFinal = stageProducedWork(notification) || stageProducedWork(privacy) || stageProducedWork(provider)
      || failed("notification") || failed("privacy") || failed("provider")
      || (dispatchAfterUpdates?.dispatched ?? 0) > 0 || failed("dispatchAfterUpdates")
      ? await run("dispatchFinal", () => this.dispatcher.dispatchBatch(50))
      : IDLE_DISPATCH;
    const audit = await run("audit", () => this.audit.processBatch(50));
    const stages = {
      dispatchInitial,
      publicCache,
      updates,
      dispatchAfterUpdates,
      notification,
      privacy,
      provider,
      dispatchFinal,
      audit,
    };
    if (failures.length > 0) {
      const summary = failures
        .map(({ stage, error }) => `${stage}: ${error instanceof Error ? error.message : String(error)}`)
        .join("; ");
      throw new Error(`Async downstream stages failed: ${summary}`, { cause: failures[0]?.error });
    }
    // /health/async treats a last success older than 60 minutes as stalled, which is four
    // 15-minute cycles. Writing less often would age a healthy idle worker into that window.
    await this.heartbeat.recordSuccess();
    return stages;
  }
}
