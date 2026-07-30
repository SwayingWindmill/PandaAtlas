import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const idempotencyKey = typeof payload?.idempotency_key === "string"
    ? payload.idempotency_key
    : "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return NextResponse.json({ detail: "Invalid idempotency key" }, { status: 400 });
  }
  const result = await callFastApiEngagement("/api/v1/me/inbox/read-all", {
    method: "POST",
    body: { idempotency_key: idempotencyKey },
  });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
