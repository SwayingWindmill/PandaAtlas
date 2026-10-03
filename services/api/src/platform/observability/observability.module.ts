import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module.js";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { PinoLoggerService } from "./pino-logger.service.js";

@Module({
  imports: [ConfigModule, RequestContextModule],
  providers: [PinoLoggerService],
  exports: [PinoLoggerService],
})
export class ObservabilityModule {}
