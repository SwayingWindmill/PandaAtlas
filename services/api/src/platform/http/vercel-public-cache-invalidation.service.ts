import { dangerouslyDeleteByTag } from "@vercel/functions";
import { PUBLIC_READ_CACHE_TAG } from "./public-cache.constants.js";
import type { PublicCacheInvalidationPort } from "./public-cache-invalidation.port.js";

function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

export class VercelPublicCacheInvalidationService implements PublicCacheInvalidationPort {
  public async purgePublicRead(): Promise<void> {
    if (!isVercelRuntime()) return;
    await dangerouslyDeleteByTag(PUBLIC_READ_CACHE_TAG, { revalidationDeadlineSeconds: 0 });
  }
}
