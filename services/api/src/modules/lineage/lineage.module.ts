import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_REFERENCE_PORT, type PandaReferencePort } from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import { LINEAGE_PUBLICATION_PORT } from "./application/lineage-publication.application.js";
import {
  LINEAGE_PORT,
  LineageApplication,
} from "./application/lineage.application.js";
import { PostgresLineagePublicationQuery } from "./infrastructure/postgres-lineage-publication.query.js";
import { PostgresLineageRepository } from "./infrastructure/postgres-lineage.repository.js";

@Module({
  imports: [DatabaseModule, PandaModule],
  providers: [
    {
      provide: LINEAGE_PORT,
      useFactory: (database: DatabaseService, pandas: PandaReferencePort) =>
        new LineageApplication(new PostgresLineageRepository(database), pandas),
      inject: [DatabaseService, PANDA_REFERENCE_PORT],
    },
    { provide: LINEAGE_PUBLICATION_PORT, useFactory: () => new PostgresLineagePublicationQuery() },
  ],
  exports: [LINEAGE_PORT, LINEAGE_PUBLICATION_PORT],
})
export class LineageModule {}
