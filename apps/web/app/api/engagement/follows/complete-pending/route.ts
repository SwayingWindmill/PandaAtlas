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
  const returnPath = typeof currentBody?.safe_return_path === "string"
    ? currentBody.safe_return_path
    : "/";
  const intentId = typeof currentBody?.intent_id === "string"
    ? currentBody.intent_id
    : null;
  if (!intentId) {
    return NextResponse.json({ detail: "Invalid pending Favorite state" }, { status: 502 });
  }

  const result = await callFastApiEngagement("/api/v1/me/follows/complete-pending", {
    method: "POST",
    body: { handle, idempotency_key: `complete-pending-${intentId}` },
  });
  if (isNextResponse(result)) return result;
  if (!result.response.ok) return engagementJsonResponse(result);

  await clearPendingFollowCookies();
  return NextResponse.json(
    { ...(result.body as object), safe_return_path: returnPath },
    { status: result.response.status, headers: { "Cache-Control": "no-store, private" } },
  );
}
