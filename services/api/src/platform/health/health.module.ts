import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { HealthController } from "./health.controller.js";
import { DatabaseReadinessProbe, READINESS_PROBE } from "./readiness.js";

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [
    DatabaseReadinessProbe,
    {
      provide: READINESS_PROBE,
      useExisting: DatabaseReadinessProbe,
    },
  ],
})
export class HealthModule {}
