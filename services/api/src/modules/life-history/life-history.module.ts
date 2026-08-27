import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PANDA_REFERENCE_PORT, type PandaReferencePort } from "../panda/application/panda.application.js";
import { PandaModule } from "../panda/panda.module.js";
import { PLACE_REFERENCE_PORT, type PlaceReferencePort } from "../places/application/places.application.js";
import { PlacesModule } from "../places/places.module.js";
import { LIFE_HISTORY_PUBLICATION_PORT } from "./application/life-history-publication.application.js";
import {
  LIFE_HISTORY_PORT,
  LIFE_HISTORY_REPOSITORY,
  LifeHistoryApplication,
  type LifeHistoryRepository,
} from "./application/life-history.application.js";
import { PostgresLifeHistoryPublicationQuery } from "./infrastructure/postgres-life-history-publication.query.js";
import { PostgresLifeHistoryRepository } from "./infrastructure/postgres-life-history.repository.js";

@Module({
  imports: [DatabaseModule, PandaModule, PlacesModule],
  providers: [
    {
      provide: LIFE_HISTORY_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresLifeHistoryRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: LIFE_HISTORY_PORT,
      useFactory: (
        repository: LifeHistoryRepository,
        pandas: PandaReferencePort,
        places: PlaceReferencePort,
      ) => new LifeHistoryApplication(repository, pandas, places),
      inject: [LIFE_HISTORY_REPOSITORY, PANDA_REFERENCE_PORT, PLACE_REFERENCE_PORT],
    },
    {
      provide: LIFE_HISTORY_PUBLICATION_PORT,
      useFactory: () => new PostgresLifeHistoryPublicationQuery(),
    },
  ],
  exports: [LIFE_HISTORY_PORT, LIFE_HISTORY_PUBLICATION_PORT],
})
export class LifeHistoryModule {}
