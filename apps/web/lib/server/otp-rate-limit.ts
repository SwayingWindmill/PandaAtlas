export interface OtpRateLimitBinding {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

const DEFAULT_RETRY_AFTER_SECONDS = 60;

export function extractClientIp(headers: Headers): string | undefined {
  const raw = headers.get("cf-connecting-ip")?.trim();
  return raw ? raw : undefined;
}

export async function hashEmailForRateLimit(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).subarray(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function enforceOtpRateLimit(input: {
  limiter: OtpRateLimitBinding | undefined;
  ip: string | undefined;
  email: string;
}): Promise<boolean> {
  if (input.limiter === undefined) return true;
  const keys: string[] = [];
  if (input.ip !== undefined) keys.push(`otp:ip:${input.ip}`);
  keys.push(`otp:email:${await hashEmailForRateLimit(input.email)}`);

  for (const key of keys) {
    try {
      const outcome = await input.limiter.limit({ key });
      if (!outcome.success) return false;
    } catch {
      // Fail open if the Cloudflare Rate Limiting binding throws so login stays available.
      return true;
    }
  }
  return true;
}

export function otpRateLimitedResponse(retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS): Response {
  return Response.json(
    { detail: "请求过于频繁，请一分钟后再试。" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store, private",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
