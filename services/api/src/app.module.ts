import { Module } from "@nestjs/common";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { ConfigModule } from "./platform/config/config.module.js";
import { HealthModule } from "./platform/health/health.module.js";
import { HttpPlatformModule } from "./platform/http/http-platform.module.js";

@Module({
  imports: [ConfigModule, HttpPlatformModule, HealthModule, IdentityModule],
})
export class AppModule {}
