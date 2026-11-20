import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { ENGAGEMENT_FOLLOW_COUNT_PORT } from "./application/engagement-follow-count.port.js";
import { ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT } from "./application/engagement-notification.port.js";
import { ENGAGEMENT_PRIVACY_PORT } from "./application/engagement-privacy.port.js";
import { ENGAGEMENT_PORT } from "./application/engagement.application.js";
import { EngagementController } from "./http/engagement.controller.js";
import { PostgresEngagementFollowCountQuery } from "./infrastructure/postgres-engagement-follow-count.query.js";
import { PostgresEngagementNotificationQuery } from "./infrastructure/postgres-engagement-notification.query.js";
import { PostgresEngagementPrivacyQuery } from "./infrastructure/postgres-engagement-privacy.query.js";
import { PostgresEngagementRepository } from "./infrastructure/postgres-engagement.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [EngagementController],
  providers: [
    {
      provide: ENGAGEMENT_PORT,
      useFactory: (database: DatabaseService) => new PostgresEngagementRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: ENGAGEMENT_FOLLOW_COUNT_PORT,
      useFactory: (database: DatabaseService) => new PostgresEngagementFollowCountQuery(database),
      inject: [DatabaseService],
    },
    {
      provide: ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT,
      useFactory: () => new PostgresEngagementNotificationQuery(),
    },
    {
      provide: ENGAGEMENT_PRIVACY_PORT,
      useFactory: () => new PostgresEngagementPrivacyQuery(),
    },
  ],
  exports: [
    ENGAGEMENT_PORT,
    ENGAGEMENT_FOLLOW_COUNT_PORT,
    ENGAGEMENT_NOTIFICATION_AUDIENCE_PORT,
    ENGAGEMENT_PRIVACY_PORT,
  ],
})
export class EngagementModule {}
