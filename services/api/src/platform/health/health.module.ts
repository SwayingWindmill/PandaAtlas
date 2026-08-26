import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { LocalReadinessProbe, READINESS_PROBE } from "./readiness.js";

@Module({
  controllers: [HealthController],
  providers: [
    LocalReadinessProbe,
    {
      provide: READINESS_PROBE,
      useExisting: LocalReadinessProbe,
    },
  ],
})
export class HealthModule {}
