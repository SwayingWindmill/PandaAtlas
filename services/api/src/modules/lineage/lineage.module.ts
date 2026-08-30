import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_REFERENCE_PORT, type PandaReferencePort } from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import { LINEAGE_PUBLICATION_PORT } from "./application/lineage-publication.application.js";
import {
  LINEAGE_CURATION_PARTICIPANT,
  LINEAGE_PORT,
  LINEAGE_REPOSITORY,
  LineageApplication,
  type LineageRepository,
} from "./application/lineage.application.js";
import { PostgresLineageCurationParticipant } from "./infrastructure/postgres-lineage-curation.participant.js";
import { PostgresLineagePublicationQuery } from "./infrastructure/postgres-lineage-publication.query.js";
import { PostgresLineageRepository } from "./infrastructure/postgres-lineage.repository.js";

@Module({
  imports: [DatabaseModule, PandaModule],
  providers: [
    {
      provide: LINEAGE_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresLineageRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: LINEAGE_PORT,
      useFactory: (repository: LineageRepository, pandas: PandaReferencePort) =>
        new LineageApplication(repository, pandas),
      inject: [LINEAGE_REPOSITORY, PANDA_REFERENCE_PORT],
    },
    { provide: LINEAGE_CURATION_PARTICIPANT, useClass: PostgresLineageCurationParticipant },
    { provide: LINEAGE_PUBLICATION_PORT, useFactory: () => new PostgresLineagePublicationQuery() },
  ],
  exports: [LINEAGE_PORT, LINEAGE_CURATION_PARTICIPANT, LINEAGE_PUBLICATION_PORT],
})
export class LineageModule {}
