import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  PLACE_REFERENCE_PORT,
  PLACES_PORT,
  PLACES_REPOSITORY,
  PlacesApplication,
  type PlacesRepository,
} from "./application/places.application.js";
import { PostgresPlacesRepository } from "./infrastructure/postgres-places.repository.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PLACES_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresPlacesRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: PlacesApplication,
      useFactory: (repository: PlacesRepository) => new PlacesApplication(repository),
      inject: [PLACES_REPOSITORY],
    },
    { provide: PLACES_PORT, useExisting: PlacesApplication },
    { provide: PLACE_REFERENCE_PORT, useExisting: PlacesApplication },
  ],
  exports: [PLACES_PORT, PLACE_REFERENCE_PORT],
})
export class PlacesModule {}
