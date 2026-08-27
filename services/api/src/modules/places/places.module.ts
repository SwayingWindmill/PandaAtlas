import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PLACES_PUBLICATION_PORT } from "./application/places-publication.application.js";
import {
  PLACE_REFERENCE_PORT,
  PLACES_PORT,
  PLACES_REPOSITORY,
  PlacesApplication,
  type PlacesRepository,
} from "./application/places.application.js";
import { PostgresPlacesPublicationQuery } from "./infrastructure/postgres-places-publication.query.js";
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
    { provide: PLACES_PUBLICATION_PORT, useFactory: () => new PostgresPlacesPublicationQuery() },
    { provide: PLACES_PORT, useExisting: PlacesApplication },
    { provide: PLACE_REFERENCE_PORT, useExisting: PlacesApplication },
  ],
  exports: [PLACES_PORT, PLACE_REFERENCE_PORT, PLACES_PUBLICATION_PORT],
})
export class PlacesModule {}
