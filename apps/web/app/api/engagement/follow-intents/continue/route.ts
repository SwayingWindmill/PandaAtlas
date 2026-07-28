import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";
import { setPendingFollowHandle } from "@/lib/server/pending-follow-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const handle = typeof payload?.continuation_handle === "string"
    ? payload.continuation_handle
    : null;
  if (!handle || handle.length < 20 || handle.length > 512) {
    return NextResponse.json({ detail: "Invalid continuation" }, { status: 400 });
  }

  const result = await callFastApiEngagement("/api/v1/follow-intents/current", {
    anonymous: true,
    headers: { "X-Pending-Follow-Handle": handle },
  });
  if (isNextResponse(result)) return result;
  if (!result.response.ok) return engagementJsonResponse(result);

  await setPendingFollowHandle(handle);
  return engagementJsonResponse(result);
}
