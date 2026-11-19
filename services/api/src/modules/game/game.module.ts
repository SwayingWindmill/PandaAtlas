import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { PUBLIC_READ_PORT, type PublicReadPort } from "../publication/application/public-read.application.js";
import { PublicationModule } from "../publication/publication.module.js";
import { DailyPandaApplication } from "./application/daily-panda.application.js";
import { PandaBookApplication } from "./application/panda-book.application.js";
import { GAME_PRIVACY_PORT } from "./application/game-privacy.port.js";
import { GAME_PORT } from "./application/game.application.js";
import {
  DailyPandaController,
  GameAttemptController,
  GameController,
  PandaBookController,
} from "./http/game.controller.js";
import { PostgresDailyPandaRepository } from "./infrastructure/postgres-daily-panda.repository.js";
import { PostgresGamePrivacyQuery } from "./infrastructure/postgres-game-privacy.query.js";
import { PostgresGameRepository } from "./infrastructure/postgres-game.repository.js";
import { PostgresPandaBookRepository } from "./infrastructure/postgres-panda-book.repository.js";

@Module({
  imports: [DatabaseModule, PublicationModule],
  controllers: [GameController, DailyPandaController, GameAttemptController, PandaBookController],
  providers: [
    {
      provide: GAME_PORT,
      useFactory: (database: DatabaseService) => new PostgresGameRepository(database),
      inject: [DatabaseService],
    },
    {
      provide: DailyPandaApplication,
      useFactory: (database: DatabaseService, publicRead: PublicReadPort) =>
        new DailyPandaApplication(new PostgresDailyPandaRepository(database), publicRead),
      inject: [DatabaseService, PUBLIC_READ_PORT],
    },
    {
      provide: PandaBookApplication,
      useFactory: (database: DatabaseService, dailyPanda: DailyPandaApplication, publicRead: PublicReadPort) =>
        new PandaBookApplication(new PostgresPandaBookRepository(database), dailyPanda, publicRead),
      inject: [DatabaseService, DailyPandaApplication, PUBLIC_READ_PORT],
    },
    { provide: GAME_PRIVACY_PORT, useFactory: () => new PostgresGamePrivacyQuery() },
  ],
  exports: [GAME_PORT, GAME_PRIVACY_PORT],
})
export class GameModule {}
