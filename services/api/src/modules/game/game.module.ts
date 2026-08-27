import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { GAME_PRIVACY_PORT } from "./application/game-privacy.port.js";
import {
  GAME_PORT,
  GAME_REPOSITORY,
  GameApplication,
  type GameRepository,
} from "./application/game.application.js";
import { GameAttemptController, GameController } from "./http/game.controller.js";
import { PostgresGamePrivacyQuery } from "./infrastructure/postgres-game-privacy.query.js";
import { PostgresGameRepository } from "./infrastructure/postgres-game.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [GameController, GameAttemptController],
  providers: [
    {
      provide: GAME_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresGameRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: GameApplication,
      useFactory: (repository: GameRepository) => new GameApplication(repository),
      inject: [GAME_REPOSITORY],
    },
    { provide: GAME_PORT, useExisting: GameApplication },
    { provide: GAME_PRIVACY_PORT, useFactory: () => new PostgresGamePrivacyQuery() },
  ],
  exports: [GAME_PORT, GAME_PRIVACY_PORT],
})
export class GameModule {}
