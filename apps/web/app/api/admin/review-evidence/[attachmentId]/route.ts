import { NextRequest, NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FASTAPI_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

interface EvidenceRouteContext {
  params: Promise<{ attachmentId: string }>;
}

export async function POST(request: NextRequest, context: EvidenceRouteContext) {
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }
  const { attachmentId } = await context.params;
  const body = await request.text();
  let response: Response;
  try {
    response = await fetch(
      `${FASTAPI_BASE_URL}/api/v1/community-intake/attachments/${encodeURIComponent(attachmentId)}/access`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Correlation-Id": crypto.randomUUID(),
        },
        body,
        cache: "no-store",
      },
    );
  } catch {
    return NextResponse.json({ detail: "Evidence service unavailable" }, { status: 502 });
  }
  const responseBody = await response.text();
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  if (!responseBody) return new NextResponse(null, { status: response.status, headers });
  try {
    return NextResponse.json(JSON.parse(responseBody), { status: response.status, headers });
  } catch {
    return NextResponse.json(
      { detail: "Invalid evidence service response" },
      { status: 502, headers },
    );
  }
}
