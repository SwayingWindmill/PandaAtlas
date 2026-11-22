import { SetMetadata } from "@nestjs/common";
import type { RateLimitRule, RateLimitTier } from "./rate-limit.types.js";

export const RATE_LIMIT_METADATA_KEY = "zhipanda:rate-limit";

export function RateLimit(
  tier: RateLimitTier,
  options: Omit<RateLimitRule, "tier"> = {},
): MethodDecorator & ClassDecorator {
  const rule: RateLimitRule = { tier, ...options };
  return SetMetadata(RATE_LIMIT_METADATA_KEY, rule);
}
