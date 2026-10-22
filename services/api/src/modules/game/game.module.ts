import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../publication/application/public-read.application.js";
import { PublicationModule } from "../publication/publication.module.js";
import {
  DAILY_PANDA_PORT,
  DAILY_PANDA_REPOSITORY,
  DailyPandaApplication,
  type DailyPandaRepository,
} from "./application/daily-panda.application.js";
import { GAME_PRIVACY_PORT } from "./application/game-privacy.port.js";
import {
  GAME_PORT,
  GAME_REPOSITORY,
  GameApplication,
  type GameRepository,
} from "./application/game.application.js";
import { DailyPandaController, GameAttemptController, GameController } from "./http/game.controller.js";
import { PostgresDailyPandaRepository } from "./infrastructure/postgres-daily-panda.repository.js";
import { PostgresGamePrivacyQuery } from "./infrastructure/postgres-game-privacy.query.js";
import { PostgresGameRepository } from "./infrastructure/postgres-game.repository.js";

@Module({
  imports: [DatabaseModule, PublicationModule],
  controllers: [GameController, DailyPandaController, GameAttemptController],
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
    {
      provide: DAILY_PANDA_REPOSITORY,
      useFactory: (database: DatabaseService) => new PostgresDailyPandaRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: DAILY_PANDA_PORT,
      useFactory: (repository: DailyPandaRepository, publicRead: PublicReadPort) =>
        new DailyPandaApplication(repository, publicRead),
      inject: [DAILY_PANDA_REPOSITORY, PUBLIC_READ_PORT],
    },
    { provide: GAME_PRIVACY_PORT, useFactory: () => new PostgresGamePrivacyQuery() },
  ],
  exports: [GAME_PORT, GAME_PRIVACY_PORT],
})
export class GameModule {}
