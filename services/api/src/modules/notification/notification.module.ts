import { Module } from "@nestjs/common";
import { AppConfig } from "../../platform/config/app-config.js";
import { ConfigModule } from "../../platform/config/config.module.js";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationEventConsumer } from "../../platform/integration/integration-event-consumer.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { PgmqService } from "../../platform/integration/pgmq.service.js";
import {
  ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT,
  type EngagementNotificationAudiencePort,
} from "../engagement/application/engagement-notification.port.js";
import { EngagementModule } from "../engagement/engagement.module.js";
import {
  IDENTITY_NOTIFICATION_CONTACT_PORT,
  type IdentityNotificationContactPort,
} from "../identity/application/identity-notification.port.js";
import { IdentityModule } from "../identity/identity.module.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../public-read/application/public-read.application.js";
import { PublicReadModule } from "../public-read/public-read.module.js";
import { NOTIFICATION_PORT, NotificationApplication } from "./application/notification.application.js";
import {
  NOTIFICATION_PROVIDER_PORT,
  NOTIFICATION_PUSH_PROVIDER_PORT,
  type NotificationProviderPort,
  type NotificationPushProviderPort,
} from "./application/notification-provider.port.js";
import { NOTIFICATION_PRIVACY_PORT } from "./application/notification-privacy.port.js";
import { NotificationController } from "./http/notification.controller.js";
import { BirthdayReminderScannerService } from "./infrastructure/birthday-reminder-scanner.service.js";
import { ExpoPushNotificationProvider } from "./infrastructure/expo-push-notification.provider.js";
import { NotificationEventConsumerService } from "./infrastructure/notification-event-consumer.service.js";
import { NotificationProviderWorkerService } from "./infrastructure/notification-provider-worker.service.js";
import { PostgresNotificationPrivacyQuery } from "./infrastructure/postgres-notification-privacy.query.js";
import { PostgresNotificationRepository } from "./infrastructure/postgres-notification.repository.js";
import { ResendNotificationProvider } from "./infrastructure/resend-notification.provider.js";

@Module({
  imports: [ConfigModule, DatabaseModule, IntegrationModule, EngagementModule, IdentityModule, PublicReadModule],
  controllers: [NotificationController],
  providers: [
    {
      provide: NOTIFICATION_PORT,
      useFactory: (database: DatabaseService) => new NotificationApplication(new PostgresNotificationRepository(database)),
      inject: [DatabaseService],
    },
    {
      provide: NOTIFICATION_PROVIDER_PORT,
      useFactory: (config: AppConfig) => new ResendNotificationProvider(config),
      inject: [AppConfig],
    },
    {
      provide: NOTIFICATION_PUSH_PROVIDER_PORT,
      useFactory: (config: AppConfig) => new ExpoPushNotificationProvider(config),
      inject: [AppConfig],
    },
    {
      provide: NotificationEventConsumerService,
      useFactory: (
        consumer: IntegrationEventConsumer,
        outbox: IntegrationOutboxService,
        pgmq: PgmqService,
        audience: EngagementNotificationAudiencePort,
        contacts: IdentityNotificationContactPort,
      ) => new NotificationEventConsumerService(consumer, outbox, pgmq, audience, contacts),
      inject: [
        IntegrationEventConsumer,
        IntegrationOutboxService,
        PgmqService,
        ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT,
        IDENTITY_NOTIFICATION_CONTACT_PORT,
      ],
    },
    {
      provide: NOTIFICATION_PRIVACY_PORT,
      useFactory: () => new PostgresNotificationPrivacyQuery(),
    },
    {
      provide: NotificationProviderWorkerService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        pgmq: PgmqService,
        contacts: IdentityNotificationContactPort,
        provider: NotificationProviderPort,
        pushProvider: NotificationPushProviderPort,
      ) => new NotificationProviderWorkerService(database, outbox, pgmq, contacts, provider, pushProvider),
      inject: [
        DatabaseService,
        IntegrationOutboxService,
        PgmqService,
        IDENTITY_NOTIFICATION_CONTACT_PORT,
        NOTIFICATION_PROVIDER_PORT,
        NOTIFICATION_PUSH_PROVIDER_PORT,
      ],
    },
    {
      provide: BirthdayReminderScannerService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        audience: EngagementNotificationAudiencePort,
        publicRead: PublicReadPort,
      ) => new BirthdayReminderScannerService(database, outbox, audience, publicRead),
      inject: [DatabaseService, IntegrationOutboxService, ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT, PUBLIC_READ_PORT],
    },
  ],
  exports: [
    NOTIFICATION_PORT,
    NOTIFICATION_PRIVACY_PORT,
    NotificationEventConsumerService,
    NotificationProviderWorkerService,
    BirthdayReminderScannerService,
  ],
})
export class NotificationModule {}
