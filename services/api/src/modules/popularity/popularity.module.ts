import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../publication/application/public-read.application.js";
import { PublicationModule } from "../publication/publication.module.js";
import { PopularityApplication } from "./application/popularity.application.js";
import { PopularityController } from "./http/popularity.controller.js";
import { PostgresPopularityRepository } from "./infrastructure/postgres-popularity.repository.js";

@Module({
  imports: [DatabaseModule, PublicationModule],
  controllers: [PopularityController],
  providers: [
    {
      provide: PopularityApplication,
      useFactory: (database: DatabaseService, publicRead: PublicReadPort) =>
        new PopularityApplication(new PostgresPopularityRepository(database), publicRead),
      inject: [DatabaseService, PUBLIC_READ_PORT],
    },
  ],
})
export class PopularityModule {}
