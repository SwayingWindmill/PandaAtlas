import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  COMPARISONS_PORT,
  COMPARISONS_REPOSITORY,
  ComparisonsApplication,
  type ComparisonsRepository,
} from "./application/comparisons.application.js";
import { ComparisonsController } from "./http/comparisons.controller.js";
import { PostgresComparisonsRepository } from "./infrastructure/postgres-comparisons.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ComparisonsController],
  providers: [
    {
      provide: COMPARISONS_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresComparisonsRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: COMPARISONS_PORT,
      useFactory: (repository: ComparisonsRepository) => new ComparisonsApplication(repository),
      inject: [COMPARISONS_REPOSITORY],
    },
  ],
})
export class ComparisonsModule {}
