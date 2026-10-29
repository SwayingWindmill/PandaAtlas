import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import {
  CONTRIBUTION_PORT,
  CONTRIBUTION_REPOSITORY,
  CONTRIBUTION_REVIEW_PARTICIPANT,
  CONTRIBUTION_REVIEW_PORT,
  ContributionApplication,
  type ContributionRepository,
} from "./application/contribution.application.js";
import { PANDA_REFERENCE_PORT, type PandaReferencePort } from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import { ContributionController } from "./http/contribution.controller.js";
import { CONTRIBUTION_PRIVACY_PORT } from "./application/contribution-privacy.port.js";
import { PostgresContributionPrivacyQuery } from "./infrastructure/postgres-contribution-privacy.query.js";
import { PostgresContributionReviewParticipant } from "./infrastructure/postgres-contribution-review.participant.js";
import { PostgresContributionRepository } from "./infrastructure/postgres-contribution.repository.js";

@Module({
  imports: [DatabaseModule, RequestContextModule, PandaModule],
  controllers: [ContributionController],
  providers: [
    {
      provide: CONTRIBUTION_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresContributionRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: ContributionApplication,
      useFactory: (repository: ContributionRepository, pandas: PandaReferencePort) =>
        new ContributionApplication(repository, pandas),
      inject: [CONTRIBUTION_REPOSITORY, PANDA_REFERENCE_PORT],
    },
    { provide: CONTRIBUTION_PORT, useExisting: ContributionApplication },
    { provide: CONTRIBUTION_REVIEW_PORT, useExisting: ContributionApplication },
    { provide: CONTRIBUTION_REVIEW_PARTICIPANT, useClass: PostgresContributionReviewParticipant },
    { provide: CONTRIBUTION_PRIVACY_PORT, useClass: PostgresContributionPrivacyQuery },
  ],
  exports: [CONTRIBUTION_PORT, CONTRIBUTION_REVIEW_PORT, CONTRIBUTION_REVIEW_PARTICIPANT, CONTRIBUTION_PRIVACY_PORT],
})
export class ContributionModule {}
