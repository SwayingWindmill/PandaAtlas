import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  ComparisonsController,
  LearningController,
  OverseasStatusController,
  VenueNewsController,
} from "./http/catalog.controllers.js";
import { PostgresJsonCatalogStore } from "./infrastructure/postgres-json-catalog.store.js";

@Module({
  imports: [DatabaseModule],
  controllers: [LearningController, OverseasStatusController, VenueNewsController, ComparisonsController],
  providers: [
    {
      provide: PostgresJsonCatalogStore,
      useFactory: (database: DatabaseService) => new PostgresJsonCatalogStore(database),
      inject: [DatabaseService],
    },
  ],
  exports: [PostgresJsonCatalogStore],
})
export class CatalogModule {}
