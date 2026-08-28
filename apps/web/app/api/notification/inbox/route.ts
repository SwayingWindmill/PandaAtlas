import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 50;

  const result = await api.client.GET("/api/v2/me/notifications", {
    params: { query: { limit } },
    headers: api.headers,
  });
  if (!result.data) return v2JsonResponse(result);

  return NextResponse.json(
    {
      items: result.data,
      unreadCount: result.data.filter((item) => item.readAt === null).length,
    },
    { status: result.response.status, headers: { "Cache-Control": "no-store, private" } },
  );
}
