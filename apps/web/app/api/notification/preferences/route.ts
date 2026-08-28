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

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/notifications/preferences", {
      headers: api.headers,
    }),
  );
}

export async function PUT(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const body = await request.json().catch(() => null) as {
    category?: "knowledge_update" | "correction";
    channel?: "station" | "email";
    enabled?: boolean;
  } | null;
  if (!body || !body.category || !body.channel || typeof body.enabled !== "boolean") {
    return NextResponse.json({ detail: "Invalid notification preference" }, { status: 400 });
  }

  return v2JsonResponse(
    await api.client.PUT("/api/v2/me/notifications/preferences", {
      body: {
        category: body.category,
        channel: body.channel,
        enabled: body.enabled,
      },
      headers: api.headers,
    }),
  );
}
