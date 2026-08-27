import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { EVIDENCE_PUBLICATION_PORT } from "./application/evidence-publication.application.js";
import {
  EVIDENCE_PORT,
  EVIDENCE_REPOSITORY,
  EvidenceApplication,
  type EvidenceRepository,
} from "./application/evidence.application.js";
import { PostgresEvidencePublicationQuery } from "./infrastructure/postgres-evidence-publication.query.js";
import { PostgresEvidenceRepository } from "./infrastructure/postgres-evidence.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: EVIDENCE_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresEvidenceRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: EVIDENCE_PORT,
      useFactory: (repository: EvidenceRepository) => new EvidenceApplication(repository),
      inject: [EVIDENCE_REPOSITORY],
    },
    { provide: EVIDENCE_PUBLICATION_PORT, useFactory: () => new PostgresEvidencePublicationQuery() },
  ],
  exports: [EVIDENCE_PORT, EVIDENCE_PUBLICATION_PORT],
})
export class EvidenceModule {}
