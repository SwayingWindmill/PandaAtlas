import { Module } from "@nestjs/common";
import { ConfigModule } from "./platform/config/config.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { HttpPlatformModule } from "./platform/http/http-platform.module.js";

@Module({
  imports: [ConfigModule, HttpPlatformModule, HealthModule],
})
export class AppModule {}
