import { NextRequest, NextResponse } from "next/server";

import { readPendingFollowContinuation } from "@/lib/server/pending-follow-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  const continuation = await readPendingFollowContinuation();
  const siteUrl = process.env.SITE_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? "http://localhost:3000";
  const redirect = new URL("/auth/login", siteUrl);
  redirect.searchParams.set("next", next);
  if (continuation) redirect.hash = `continue=${encodeURIComponent(continuation)}`;

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
