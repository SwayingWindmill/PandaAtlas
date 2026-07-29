import { NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";
import {
  clearPendingFollowCookies,
  readPendingFollowHandle,
} from "@/lib/server/pending-follow-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const handle = await readPendingFollowHandle();
  if (!handle) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const current = await callFastApiEngagement("/api/v1/follow-intents/current", {
    anonymous: true,
    headers: { "X-Pending-Follow-Handle": handle },
  });
  if (isNextResponse(current)) return current;
  if (!current.response.ok) return engagementJsonResponse(current);
  const currentBody = current.body as Record<string, unknown> | null;
  const intentId = typeof currentBody?.intent_id === "string" ? currentBody.intent_id : null;
  if (!intentId) {
    return NextResponse.json({ detail: "Invalid pending Follow state" }, { status: 502 });
  }
  const result = await callFastApiEngagement("/api/v1/follow-intents/cancel", {
    method: "POST",
    anonymous: true,
    body: { handle, idempotency_key: `cancel-pending-${intentId}` },
  });
  if (isNextResponse(result)) return result;
  if (result.response.ok) await clearPendingFollowCookies();
  return engagementJsonResponse(result);
}
