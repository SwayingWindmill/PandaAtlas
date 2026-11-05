import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../publication/application/public-read.application.js";
import { PublicationModule } from "../publication/publication.module.js";
import {
  POPULARITY_PORT,
  POPULARITY_REPOSITORY,
  PopularityApplication,
  type PopularityRepository,
} from "./application/popularity.application.js";
import { PopularityController } from "./http/popularity.controller.js";
import { PostgresPopularityRepository } from "./infrastructure/postgres-popularity.repository.js";

@Module({
  imports: [DatabaseModule, PublicationModule],
  controllers: [PopularityController],
  providers: [
    {
      provide: POPULARITY_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresPopularityRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: POPULARITY_PORT,
      useFactory: (repository: PopularityRepository, publicRead: PublicReadPort) => new PopularityApplication(repository, publicRead),
      inject: [POPULARITY_REPOSITORY, PUBLIC_READ_PORT],
    },
  ],
})
export class PopularityModule {}
