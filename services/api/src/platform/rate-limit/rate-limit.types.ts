export type RateLimitTier = "write" | "sensitive";

export type RateLimitKeyStrategy = "account_or_ip" | "ip_and_account" | "ip";

export interface RateLimitRule {
  tier: RateLimitTier;
  keyStrategy?: RateLimitKeyStrategy;
  retryAfterSeconds?: number;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitWorkerBindings {
  WRITE_RATE_LIMIT?: RateLimitBinding;
  SENSITIVE_RATE_LIMIT?: RateLimitBinding;
}

export const RATE_LIMIT_OVERRIDE = Symbol("RATE_LIMIT_OVERRIDE");
