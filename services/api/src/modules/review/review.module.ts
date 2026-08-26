import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { IntegrationModule } from "../../platform/integration/integration.module.js";
import { IntegrationOutboxService } from "../../platform/integration/integration-outbox.service.js";
import { RequestContextModule } from "../../platform/request-context/request-context.module.js";
import { EVIDENCE_PORT, type EvidencePort } from "../evidence/application/evidence.application.js";
import { EvidenceModule } from "../evidence/evidence.module.js";
import {
  CONTRIBUTION_REVIEW_PORT,
  type ContributionReviewPort,
} from "../contribution/application/contribution.application.js";
import { ContributionModule } from "../contribution/contribution.module.js";
import {
  CURATION_INTAKE_PORT,
  type CurationIntakePort,
} from "../curation/application/curation.application.js";
import { CurationModule } from "../curation/curation.module.js";
import {
  REVIEW_PORT,
  REVIEW_REPOSITORY,
  ReviewApplication,
  type ReviewRepository,
} from "./application/review.application.js";
import { ReviewController } from "./http/review.controller.js";
import { PostgresReviewRepository } from "./infrastructure/postgres-review.repository.js";

@Module({
  imports: [
    DatabaseModule,
    IntegrationModule,
    RequestContextModule,
    ContributionModule,
    CurationModule,
    EvidenceModule,
  ],
  controllers: [ReviewController],
  providers: [
    {
      provide: REVIEW_REPOSITORY,
      useFactory: (database: DatabaseService, outbox: IntegrationOutboxService) =>
        new PostgresReviewRepository(database, outbox),
      inject: [DatabaseService, IntegrationOutboxService],
    },
    {
      provide: ReviewApplication,
      useFactory: (
        repository: ReviewRepository,
        contributions: ContributionReviewPort,
        curation: CurationIntakePort,
        evidence: EvidencePort,
      ) => new ReviewApplication(repository, contributions, curation, evidence),
      inject: [REVIEW_REPOSITORY, CONTRIBUTION_REVIEW_PORT, CURATION_INTAKE_PORT, EVIDENCE_PORT],
    },
    { provide: REVIEW_PORT, useExisting: ReviewApplication },
  ],
  exports: [REVIEW_PORT],
})
export class ReviewModule {}
