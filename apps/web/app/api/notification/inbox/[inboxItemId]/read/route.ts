import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface InboxReadContext {
  params: Promise<{ inboxItemId: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: InboxReadContext) {
  const { inboxItemId } = await context.params;
  if (!UUID_PATTERN.test(inboxItemId)) {
    return NextResponse.json({ detail: "Invalid Inbox item" }, { status: 400 });
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const idempotencyKey = typeof payload?.idempotency_key === "string"
    ? payload.idempotency_key
    : "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255) {
    return NextResponse.json({ detail: "Invalid idempotency key" }, { status: 400 });
  }
  const result = await callFastApiEngagement(
    `/api/v1/me/inbox/${encodeURIComponent(inboxItemId)}/read`,
    { method: "POST", body: { idempotency_key: idempotencyKey } },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
