import { Inject, Injectable } from "@nestjs/common";
import { AppConfig } from "../config/app-config.js";
import {
  PUBLIC_CACHE_INVALIDATION_PORT,
  type PublicCacheInvalidationPort,
} from "./public-cache-invalidation.port.js";

const WEB_REVALIDATION_PATH = "/api/internal/publication/revalidate";

@Injectable()
export class PublicCacheInvalidationService {
  public constructor(
    private readonly config: AppConfig,
    @Inject(PUBLIC_CACHE_INVALIDATION_PORT) private readonly apiCache: PublicCacheInvalidationPort,
  ) {}

  public async invalidatePublication(): Promise<void> {
    await this.apiCache.purgePublicRead();

    const publicWebBaseUrl = this.config.publicWebBaseUrl;
    const publicRevalidationAuth = this.config.publicRevalidationAuth;
    if (publicWebBaseUrl === undefined || publicRevalidationAuth === undefined) return;

    const response = await fetch(`${publicWebBaseUrl}${WEB_REVALIDATION_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publicRevalidationAuth}`,
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`Web publication cache revalidation failed with HTTP ${response.status}`);
    }
  }
}
