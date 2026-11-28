import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module.js";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { OpsAlertRuntimeService } from "./ops-alert-runtime.service.js";
import { OpsAlertService } from "./ops-alert.service.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

@Module({
  imports: [ConfigModule, RequestContextModule],
  providers: [StructuredLoggerService, OpsAlertRuntimeService, OpsAlertService],
  exports: [StructuredLoggerService, OpsAlertRuntimeService, OpsAlertService],
})
export class ObservabilityModule {}
