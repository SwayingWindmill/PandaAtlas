import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import {
  IDENTITY_MODERATION_PARTICIPANT,
  type IdentityModerationParticipant,
} from "../identity/application/identity-moderation.port.js";
import { IdentityModule } from "../identity/identity.module.js";
import {
  MODERATION_PORT,
  MODERATION_REPOSITORY,
  ModerationApplication,
  type ModerationRepository,
} from "./application/moderation.application.js";
import { ModerationController, OwnModerationController } from "./http/moderation.controller.js";
import { PostgresModerationRepository } from "./infrastructure/postgres-moderation.repository.js";

@Module({
  imports: [DatabaseModule, RequestContextModule, IdentityModule],
  controllers: [ModerationController, OwnModerationController],
  providers: [
    {
      provide: MODERATION_REPOSITORY,
      useFactory: (database: DatabaseService, identity: IdentityModerationParticipant) =>
        new PostgresModerationRepository(database, identity),
      inject: [DatabaseService, IDENTITY_MODERATION_PARTICIPANT],
    },
    {
      provide: ModerationApplication,
      useFactory: (repository: ModerationRepository) => new ModerationApplication(repository),
      inject: [MODERATION_REPOSITORY],
    },
    { provide: MODERATION_PORT, useExisting: ModerationApplication },
  ],
  exports: [MODERATION_PORT],
})
export class ModerationModule {}
