import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

import { enforceOtpRateLimit, extractClientIp, otpRateLimitedResponse } from "@/lib/server/otp-rate-limit";
import { refuseStateChange } from "@/lib/server/v2-forwarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refused = refuseStateChange(request);
  if (refused !== undefined) return refused;
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const next = typeof payload?.next === "string"
    && payload.next.startsWith("/")
    && !payload.next.startsWith("//")
    && !payload.next.includes("\\")
    ? payload.next
    : "/";
  if (!email || email.length > 320) {
    return NextResponse.json({ detail: "Invalid request" }, { status: 400 });
  }

  const allowed = await enforceOtpRateLimit({
    limiter: env.AUTH_OTP_RATE_LIMIT,
    ip: extractClientIp(request.headers),
    email,
  });
  if (!allowed) return otpRateLimitedResponse();

  const siteUrl = process.env.SITE_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? "http://localhost:3000";
  const redirect = new URL("/auth/login", siteUrl);
  redirect.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirect.toString(),
    },
  });

  return NextResponse.json(
    { message: "如果该邮箱可用，我们已发送验证码。" },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
