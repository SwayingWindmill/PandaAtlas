import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../observability/observability.module.js";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { RateLimitGuard } from "./rate-limit.guard.js";
import { RateLimitRuntimeService } from "./rate-limit-runtime.service.js";

@Module({
  imports: [ObservabilityModule, RequestContextModule],
  providers: [RateLimitRuntimeService, RateLimitGuard],
  exports: [RateLimitRuntimeService, RateLimitGuard],
})
export class RateLimitModule {}
