import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT } from "./application/engagement-notification.port.js";
import { ENGAGEMENT_PRIVACY_PORT } from "./application/engagement-privacy.port.js";
import {
  ENGAGEMENT_PORT,
  ENGAGEMENT_REPOSITORY,
  EngagementApplication,
  type EngagementRepository,
} from "./application/engagement.application.js";
import { EngagementController } from "./http/engagement.controller.js";
import { PostgresEngagementNotificationQuery } from "./infrastructure/postgres-engagement-notification.query.js";
import { PostgresEngagementPrivacyQuery } from "./infrastructure/postgres-engagement-privacy.query.js";
import { PostgresEngagementRepository } from "./infrastructure/postgres-engagement.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [EngagementController],
  providers: [
    {
      provide: ENGAGEMENT_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresEngagementRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: EngagementApplication,
      useFactory: (repository: EngagementRepository) => new EngagementApplication(repository),
      inject: [ENGAGEMENT_REPOSITORY],
    },
    { provide: ENGAGEMENT_PORT, useExisting: EngagementApplication },
    {
      provide: ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT,
      useFactory: () => new PostgresEngagementNotificationQuery(),
    },
    {
      provide: ENGAGEMENT_PRIVACY_PORT,
      useFactory: () => new PostgresEngagementPrivacyQuery(),
    },
  ],
  exports: [ENGAGEMENT_PORT, ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT, ENGAGEMENT_PRIVACY_PORT],
})
export class EngagementModule {}
