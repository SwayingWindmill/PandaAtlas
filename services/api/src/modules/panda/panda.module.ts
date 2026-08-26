import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  PANDA_PORT,
  PANDA_REFERENCE_PORT,
  PANDA_REPOSITORY,
  PandaApplication,
  type PandaRepository,
} from "./application/panda.application.js";
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
    { provide: PANDA_PORT, useExisting: PandaApplication },
    { provide: PANDA_REFERENCE_PORT, useExisting: PandaApplication },
  ],
  exports: [PANDA_PORT, PANDA_REFERENCE_PORT],
})
export class PandaModule {}
