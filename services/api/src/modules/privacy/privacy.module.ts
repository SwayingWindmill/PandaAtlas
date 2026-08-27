import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import {
  ENGAGEMENT_PRIVACY_PORT,
  type EngagementPrivacyPort,
} from "../engagement/application/engagement-privacy.port.js";
import { EngagementModule } from "../engagement/engagement.module.js";
import { GAME_PRIVACY_PORT, type GamePrivacyPort } from "../game/application/game-privacy.port.js";
import { GameModule } from "../game/game.module.js";
import { IDENTITY_PRIVACY_PORT, type IdentityPrivacyPort } from "../identity/application/identity-privacy.port.js";
import { IdentityModule } from "../identity/identity.module.js";
import {
  NOTIFICATION_PRIVACY_PORT,
  type NotificationPrivacyPort,
} from "../notification/application/notification-privacy.port.js";
import { NotificationModule } from "../notification/notification.module.js";
import {
  PRIVACY_PORT,
  PRIVACY_REPOSITORY,
  PrivacyApplication,
  type PrivacyRepository,
} from "./application/privacy.application.js";
import { PrivacyController } from "./http/privacy.controller.js";
import { PostgresPrivacyRepository } from "./infrastructure/postgres-privacy.repository.js";
import { PrivacyRequestProcessorService } from "./infrastructure/privacy-request-processor.service.js";

@Module({
  imports: [
    DatabaseModule,
    IntegrationModule,
    RequestContextModule,
    IdentityModule,
    EngagementModule,
    GameModule,
    NotificationModule,
  ],
  controllers: [PrivacyController],
  providers: [
    {
      provide: PRIVACY_REPOSITORY,
      useFactory: (database: DatabaseService, outbox: IntegrationOutboxService) =>
        new PostgresPrivacyRepository(database, outbox),
      inject: [DatabaseService, IntegrationOutboxService],
    },
    {
      provide: PRIVACY_PORT,
      useFactory: (repository: PrivacyRepository) => new PrivacyApplication(repository),
      inject: [PRIVACY_REPOSITORY],
    },
    {
      provide: PrivacyRequestProcessorService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        identity: IdentityPrivacyPort,
        engagement: EngagementPrivacyPort,
        game: GamePrivacyPort,
        notification: NotificationPrivacyPort,
      ) => new PrivacyRequestProcessorService(database, outbox, identity, engagement, game, notification),
      inject: [
        DatabaseService,
        IntegrationOutboxService,
        IDENTITY_PRIVACY_PORT,
        ENGAGEMENT_PRIVACY_PORT,
        GAME_PRIVACY_PORT,
        NOTIFICATION_PRIVACY_PORT,
      ],
    },
  ],
  exports: [PRIVACY_PORT, PrivacyRequestProcessorService],
})
export class PrivacyModule {}
