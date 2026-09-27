import { Module } from "@nestjs/common";
import { PUBLIC_CACHE_INVALIDATION_PORT } from "./public-cache-invalidation.port.js";
import { VercelPublicCacheInvalidationService } from "./vercel-public-cache-invalidation.service.js";

@Module({
  providers: [
    {
      provide: PUBLIC_CACHE_INVALIDATION_PORT,
      useClass: VercelPublicCacheInvalidationService,
    },
  ],
  exports: [PUBLIC_CACHE_INVALIDATION_PORT],
})
export class PublicCacheModule {}
