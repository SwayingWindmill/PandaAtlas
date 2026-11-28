import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../platform/database/database.module.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { DAILY_CHECKIN_PRIVACY_PORT } from "./application/daily-checkin-privacy.port.js";
import { DAILY_CHECKIN_PORT, DailyCheckinApplication } from "./application/daily-checkin.application.js";
import { DailyCheckinController } from "./http/daily-checkin.controller.js";
import { PostgresDailyCheckinPrivacyQuery } from "./infrastructure/postgres-daily-checkin-privacy.query.js";
import { PostgresDailyCheckinRepository } from "./infrastructure/postgres-daily-checkin.repository.js";

@Module({
  imports: [DatabaseModule],
  controllers: [DailyCheckinController],
  providers: [
    {
      provide: DAILY_CHECKIN_PORT,
      useFactory: (database: DatabaseService) =>
        new DailyCheckinApplication(new PostgresDailyCheckinRepository(database)),
      inject: [DatabaseService],
    },
    {
      provide: DAILY_CHECKIN_PRIVACY_PORT,
      useFactory: () => new PostgresDailyCheckinPrivacyQuery(),
    },
  ],
  exports: [DAILY_CHECKIN_PORT, DAILY_CHECKIN_PRIVACY_PORT],
})
export class DailyCheckinModule {}
