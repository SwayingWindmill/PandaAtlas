import type { AuditEventConsumerService } from "../modules/audit/infrastructure/audit-event-consumer.service.js";
import type { NotificationEventConsumerService } from "../modules/notification/infrastructure/notification-event-consumer.service.js";
import type { NotificationProviderWorkerService } from "../modules/notification/infrastructure/notification-provider-worker.service.js";
import type { PublicCachePort } from "../modules/publication/application/public-cache.port.js";
import type { PublicCacheConsumerService } from "../modules/publication/infrastructure/public-cache-consumer.service.js";
import type { PrivacyRequestProcessorService } from "../modules/privacy/infrastructure/privacy-request-processor.service.js";
import type { UpdatesEventConsumerService } from "../modules/updates/infrastructure/updates-event-consumer.service.js";
import type { OutboxDispatcherService } from "../platform/integration/outbox-dispatcher.service.js";

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
  ) {}

  public async runCycle(effects: AsyncDownstreamEffects) {
    const dispatchInitial = await this.dispatcher.dispatchBatch(50);
    const publicCache = await this.publicCache.processBatch(effects.publicCache);
    const updates = await this.updates.processBatch(25);
    const dispatchAfterUpdates = await this.dispatcher.dispatchBatch(50);
    const notification = await this.notification.processBatch(25);
    const privacy = await this.privacy.processBatch(5);
    const provider = await this.provider.processBatch(10);
    const dispatchFinal = await this.dispatcher.dispatchBatch(50);
    const audit = await this.audit.processBatch(50);
    return {
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
  }
}
