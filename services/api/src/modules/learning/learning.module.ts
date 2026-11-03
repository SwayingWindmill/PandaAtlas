import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import {
  LEARNING_PORT,
  LEARNING_REPOSITORY,
  LearningApplication,
  type LearningRepository,
} from "./application/learning.application.js";
import { LearningController } from "./http/learning.controller.js";
import { PostgresLearningRepository } from "./infrastructure/postgres-learning.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [LearningController],
  providers: [
    {
      provide: LEARNING_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresLearningRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: LEARNING_PORT,
      useFactory: (repository: LearningRepository) => new LearningApplication(repository),
      inject: [LEARNING_REPOSITORY],
    },
  ],
})
export class LearningModule {}
