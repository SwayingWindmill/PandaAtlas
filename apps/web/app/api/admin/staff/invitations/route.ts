import type { components } from "@zhipanda/api-client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  return v2JsonResponse(await api.client.GET("/api/v2/staff/invitations", { headers: api.headers }));
}

export async function POST(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as components["schemas"]["InviteReviewerDto"] | null;
  if (!body?.email) {
    return NextResponse.json({ detail: "必须填写受邀工作人员的邮箱。" }, { status: 400 });
  }
  return v2JsonResponse(await api.client.POST("/api/v2/staff/invitations", {
    headers: api.headers,
    body,
  }));
}
