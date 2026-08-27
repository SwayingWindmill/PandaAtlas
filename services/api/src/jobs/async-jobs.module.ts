import { Module } from "@nestjs/common";
import { AuditModule } from "../modules/audit/audit.module.js";
import { AuditEventConsumerService } from "../modules/audit/infrastructure/audit-event-consumer.service.js";
import { NotificationEventConsumerService } from "../modules/notification/infrastructure/notification-event-consumer.service.js";
import { NotificationProviderWorkerService } from "../modules/notification/infrastructure/notification-provider-worker.service.js";
import { NotificationModule } from "../modules/notification/notification.module.js";
import { PrivacyRequestProcessorService } from "../modules/privacy/infrastructure/privacy-request-processor.service.js";
import { PrivacyModule } from "../modules/privacy/privacy.module.js";
import { UpdatesEventConsumerService } from "../modules/updates/infrastructure/updates-event-consumer.service.js";
import { UpdatesModule } from "../modules/updates/updates.module.js";
import { ConfigModule } from "../platform/config/config.module.js";
import { IntegrationModule } from "../platform/integration/integration.module.js";
import { OutboxDispatcherService } from "../platform/integration/outbox-dispatcher.service.js";
import { AsyncDownstreamRunnerService } from "./async-downstream-runner.service.js";
import { AsyncJobsController } from "./async-jobs.controller.js";

@Module({
  imports: [ConfigModule, IntegrationModule, UpdatesModule, NotificationModule, PrivacyModule, AuditModule],
  controllers: [AsyncJobsController],
  providers: [
    {
      provide: AsyncDownstreamRunnerService,
      useFactory: (
        dispatcher: OutboxDispatcherService,
        updates: UpdatesEventConsumerService,
        notification: NotificationEventConsumerService,
        privacy: PrivacyRequestProcessorService,
        provider: NotificationProviderWorkerService,
        audit: AuditEventConsumerService,
      ) => new AsyncDownstreamRunnerService(dispatcher, updates, notification, privacy, provider, audit),
      inject: [
        OutboxDispatcherService,
        UpdatesEventConsumerService,
        NotificationEventConsumerService,
        PrivacyRequestProcessorService,
        NotificationProviderWorkerService,
        AuditEventConsumerService,
      ],
    },
  ],
  exports: [AsyncDownstreamRunnerService],
})
export class AsyncJobsModule {}
