import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  VENUE_NEWS_PORT,
  VENUE_NEWS_REPOSITORY,
  VenueNewsApplication,
  type VenueNewsRepository,
} from "./application/venue-news.application.js";
import { VenueNewsController } from "./http/venue-news.controller.js";
import { PostgresVenueNewsRepository } from "./infrastructure/postgres-venue-news.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [VenueNewsController],
  providers: [
    {
      provide: VENUE_NEWS_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresVenueNewsRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: VENUE_NEWS_PORT,
      useFactory: (repository: VenueNewsRepository) => new VenueNewsApplication(repository),
      inject: [VENUE_NEWS_REPOSITORY],
    },
  ],
})
export class VenueNewsModule {}
