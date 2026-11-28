import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_PUBLICATION_PORT } from "./application/panda-publication.application.js";
import {
  PANDA_FACT_PARTICIPANT,
  PANDA_PORT,
  PANDA_REFERENCE_PORT,
  PandaApplication,
} from "./application/panda.application.js";
import { PostgresPandaFactParticipant } from "./infrastructure/postgres-panda-fact.participant.js";
import { PostgresPandaPublicationQuery } from "./infrastructure/postgres-panda-publication.query.js";
import { PostgresPandaRepository } from "./infrastructure/postgres-panda.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PandaApplication,
      useFactory: (database: DatabaseService) => new PandaApplication(new PostgresPandaRepository(database)),
      inject: [DatabaseService],
    },
    { provide: PostgresPandaFactParticipant, useClass: PostgresPandaFactParticipant },
    {
      provide: PANDA_PUBLICATION_PORT,
      useFactory: () => new PostgresPandaPublicationQuery(),
    },
    { provide: PANDA_PORT, useExisting: PandaApplication },
    { provide: PANDA_REFERENCE_PORT, useExisting: PandaApplication },
    { provide: PANDA_FACT_PARTICIPANT, useExisting: PostgresPandaFactParticipant },
  ],
  exports: [PANDA_PORT, PANDA_REFERENCE_PORT, PANDA_FACT_PARTICIPANT, PANDA_PUBLICATION_PORT],
})
export class PandaModule {}
