import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface PreferenceRouteContext {
  params: Promise<{ category: string; channel: string }>;
}

export async function PUT(request: NextRequest, context: PreferenceRouteContext) {
  const { category, channel } = await context.params;
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const idempotencyKey = typeof payload?.idempotency_key === "string"
    ? payload.idempotency_key
    : "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return NextResponse.json({ detail: "Invalid idempotency key" }, { status: 400 });
  }
  const result = await callFastApiEngagement(
    `/api/v1/me/notification-preferences/${encodeURIComponent(category)}/${encodeURIComponent(channel)}`,
    {
      method: "PUT",
      body: {
        enabled: payload?.enabled === true,
        idempotency_key: idempotencyKey,
      },
    },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
