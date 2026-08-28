import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_PUBLICATION_PORT } from "./application/panda-publication.application.js";
import {
  PANDA_CURATION_PARTICIPANT,
  PANDA_PORT,
  PANDA_REFERENCE_PORT,
  PANDA_REPOSITORY,
  PandaApplication,
  type PandaRepository,
} from "./application/panda.application.js";
import { PostgresPandaCurationParticipant } from "./infrastructure/postgres-panda-curation.participant.js";
import { PostgresPandaPublicationQuery } from "./infrastructure/postgres-panda-publication.query.js";
import { PostgresPandaRepository } from "./infrastructure/postgres-panda.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PANDA_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresPandaRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: PandaApplication,
      useFactory: (repository: PandaRepository) => new PandaApplication(repository),
      inject: [PANDA_REPOSITORY],
    },
    {
      provide: PostgresPandaCurationParticipant,
      useFactory: (database: DatabaseService) => new PostgresPandaCurationParticipant(database),
      inject: [DatabaseService],
    },
    {
      provide: PANDA_PUBLICATION_PORT,
      useFactory: () => new PostgresPandaPublicationQuery(),
    },
    { provide: PANDA_PORT, useExisting: PandaApplication },
    { provide: PANDA_REFERENCE_PORT, useExisting: PandaApplication },
    { provide: PANDA_CURATION_PARTICIPANT, useExisting: PostgresPandaCurationParticipant },
  ],
  exports: [PANDA_PORT, PANDA_REFERENCE_PORT, PANDA_CURATION_PARTICIPANT, PANDA_PUBLICATION_PORT],
})
export class PandaModule {}
