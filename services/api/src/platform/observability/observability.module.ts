import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module.js";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

@Module({
  imports: [ConfigModule, RequestContextModule],
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class ObservabilityModule {}
