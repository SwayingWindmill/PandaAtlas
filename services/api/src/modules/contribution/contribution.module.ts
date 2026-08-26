import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import {
  CONTRIBUTION_PORT,
  CONTRIBUTION_REPOSITORY,
  CONTRIBUTION_REVIEW_PORT,
  ContributionApplication,
  type ContributionRepository,
} from "./application/contribution.application.js";
import { ContributionController } from "./http/contribution.controller.js";
import { PostgresContributionRepository } from "./infrastructure/postgres-contribution.repository.js";

@Module({
  imports: [DatabaseModule, RequestContextModule],
  controllers: [ContributionController],
  providers: [
    {
      provide: CONTRIBUTION_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresContributionRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: ContributionApplication,
      useFactory: (repository: ContributionRepository) => new ContributionApplication(repository),
      inject: [CONTRIBUTION_REPOSITORY],
    },
    { provide: CONTRIBUTION_PORT, useExisting: ContributionApplication },
    { provide: CONTRIBUTION_REVIEW_PORT, useExisting: ContributionApplication },
  ],
  exports: [CONTRIBUTION_PORT, CONTRIBUTION_REVIEW_PORT],
})
export class ContributionModule {}
