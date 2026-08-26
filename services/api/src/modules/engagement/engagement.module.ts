import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  ENGAGEMENT_PORT,
  ENGAGEMENT_REPOSITORY,
  EngagementApplication,
  type EngagementRepository,
} from "./application/engagement.application.js";
import { EngagementController } from "./http/engagement.controller.js";
import { PostgresEngagementRepository } from "./infrastructure/postgres-engagement.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [EngagementController],
  providers: [
    {
      provide: ENGAGEMENT_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresEngagementRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: EngagementApplication,
      useFactory: (repository: EngagementRepository) => new EngagementApplication(repository),
      inject: [ENGAGEMENT_REPOSITORY],
    },
    { provide: ENGAGEMENT_PORT, useExisting: EngagementApplication },
  ],
  exports: [ENGAGEMENT_PORT],
})
export class EngagementModule {}
