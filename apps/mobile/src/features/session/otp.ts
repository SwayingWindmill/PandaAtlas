/** Supabase Auth refuses another code for the same address within a minute, so the resend waits as long. */
export const RESEND_SECONDS = 60;

/** How long a code stays valid: Supabase Auth's `otp_expiry` (infra/supabase/config.toml). */
export const CODE_LIFETIME_MS = 3_600_000;

export function secondsUntilResend(sentAt: number, now: number): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000));
}

/**
 * Supabase answers a wrong code and an expired one alike (`otp_expired`), so the age of the newest code
 * tells them apart: a code older than its lifetime has expired, a younger one was mistyped.
 */
export function rejectedCodeMessage(sentAt: number, now: number): string {
  return now - sentAt >= CODE_LIFETIME_MS ? "验证码已过期，请重新获取。" : "验证码不对，请检查后再输入。";
}
