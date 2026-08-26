import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_REFERENCE_PORT, type PandaReferencePort } from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import {
  LINEAGE_PORT,
  LINEAGE_REPOSITORY,
  LineageApplication,
  type LineageRepository,
} from "./application/lineage.application.js";
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
  ],
  exports: [LINEAGE_PORT],
})
export class LineageModule {}
