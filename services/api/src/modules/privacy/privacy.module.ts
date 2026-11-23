import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { ObservabilityModule } from "../../platform/observability/observability.module.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { AskModule } from "../ask/ask.module.js";
import { ASK_PRIVACY_PORT, type AskPrivacyPort } from "../ask/application/ask-privacy.port.js";
import {
  CONTRIBUTION_PRIVACY_PORT,
  type ContributionPrivacyPort,
} from "../contribution/application/contribution-privacy.port.js";
import { ContributionModule } from "../contribution/contribution.module.js";
import {
  DAILY_CHECKIN_PRIVACY_PORT,
  type DailyCheckinPrivacyPort,
} from "../daily-checkin/application/daily-checkin-privacy.port.js";
import { DailyCheckinModule } from "../daily-checkin/daily-checkin.module.js";
import {
  ENGAGEMENT_PRIVACY_PORT,
  type EngagementPrivacyPort,
} from "../engagement/application/engagement-privacy.port.js";
import { EngagementModule } from "../engagement/engagement.module.js";
import { GAME_PRIVACY_PORT, type GamePrivacyPort } from "../game/application/game-privacy.port.js";
import { GameModule } from "../game/game.module.js";
import { AUTH_USER_DELETION, type AuthUserDeletion } from "../identity/application/auth-user-deletion.js";
import { IDENTITY_PRIVACY_PORT, type IdentityPrivacyPort } from "../identity/application/identity-privacy.port.js";
import { IdentityModule } from "../identity/identity.module.js";
import {
  NOTIFICATION_PRIVACY_PORT,
  type NotificationPrivacyPort,
} from "../notification/application/notification-privacy.port.js";
import { NotificationModule } from "../notification/notification.module.js";
import { PRIVACY_PORT } from "./application/privacy.application.js";
import { PrivacyController } from "./http/privacy.controller.js";
import { PostgresPrivacyRepository } from "./infrastructure/postgres-privacy.repository.js";
import { PrivacyRequestProcessorService } from "./infrastructure/privacy-request-processor.service.js";

@Module({
  imports: [
    DatabaseModule,
    IntegrationModule,
    ObservabilityModule,
    RequestContextModule,
    IdentityModule,
    ContributionModule,
    EngagementModule,
    DailyCheckinModule,
    AskModule,
    GameModule,
    NotificationModule,
  ],
  controllers: [PrivacyController],
  providers: [
    {
      provide: PRIVACY_PORT,
      useFactory: (database: DatabaseService, outbox: IntegrationOutboxService) =>
        new PostgresPrivacyRepository(database, outbox),
      inject: [DatabaseService, IntegrationOutboxService],
    },
    {
      provide: PrivacyRequestProcessorService,
      useFactory: (
        database: DatabaseService,
        outbox: IntegrationOutboxService,
        identity: IdentityPrivacyPort,
        engagement: EngagementPrivacyPort,
        dailyCheckin: DailyCheckinPrivacyPort,
        ask: AskPrivacyPort,
        game: GamePrivacyPort,
        notification: NotificationPrivacyPort,
        contribution: ContributionPrivacyPort,
        authUsers: AuthUserDeletion,
      ) =>
        new PrivacyRequestProcessorService(
          database,
          outbox,
          identity,
          engagement,
          dailyCheckin,
          ask,
          game,
          notification,
          contribution,
          authUsers,
        ),
      inject: [
        DatabaseService,
        IntegrationOutboxService,
        IDENTITY_PRIVACY_PORT,
        ENGAGEMENT_PRIVACY_PORT,
        DAILY_CHECKIN_PRIVACY_PORT,
        ASK_PRIVACY_PORT,
        GAME_PRIVACY_PORT,
        NOTIFICATION_PRIVACY_PORT,
        CONTRIBUTION_PRIVACY_PORT,
        AUTH_USER_DELETION,
      ],
    },
  ],
  exports: [PRIVACY_PORT, PrivacyRequestProcessorService],
})
export class PrivacyModule {}
