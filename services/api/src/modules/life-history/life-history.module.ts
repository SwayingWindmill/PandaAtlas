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
  LifeHistoryApplication,
} from "./application/life-history.application.js";
import { PostgresLifeHistoryPublicationQuery } from "./infrastructure/postgres-life-history-publication.query.js";
import { PostgresLifeHistoryRepository } from "./infrastructure/postgres-life-history.repository.js";

@Module({
  imports: [DatabaseModule, PandaModule, PlacesModule],
  providers: [
    {
      provide: LIFE_HISTORY_PORT,
      useFactory: (
        database: DatabaseService,
        pandas: PandaReferencePort,
        places: PlaceReferencePort,
      ) => new LifeHistoryApplication(new PostgresLifeHistoryRepository(database), pandas, places),
      inject: [DatabaseService, PANDA_REFERENCE_PORT, PLACE_REFERENCE_PORT],
    },
    {
      provide: LIFE_HISTORY_PUBLICATION_PORT,
      useFactory: () => new PostgresLifeHistoryPublicationQuery(),
    },
  ],
  exports: [LIFE_HISTORY_PORT, LIFE_HISTORY_PUBLICATION_PORT],
})
export class LifeHistoryModule {}
