import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  OVERSEAS_STATUS_PORT,
  OVERSEAS_STATUS_REPOSITORY,
  OverseasStatusApplication,
  type OverseasStatusRepository,
} from "./application/overseas-status.application.js";
import { OverseasStatusController } from "./http/overseas-status.controller.js";
import { PostgresOverseasStatusRepository } from "./infrastructure/postgres-overseas-status.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [OverseasStatusController],
  providers: [
    {
      provide: OVERSEAS_STATUS_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresOverseasStatusRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: OVERSEAS_STATUS_PORT,
      useFactory: (repository: OverseasStatusRepository) => new OverseasStatusApplication(repository),
      inject: [OVERSEAS_STATUS_REPOSITORY],
    },
  ],
})
export class OverseasStatusModule {}
