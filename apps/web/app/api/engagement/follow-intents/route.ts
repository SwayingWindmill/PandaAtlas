import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";
import {
  readPendingFollowHandle,
  setPendingFollowCookies,
} from "@/lib/server/pending-follow-cookie";

export const dynamic = "force-dynamic";

interface PendingFollowResponse {
  handle: string;
  continuation_handle: string;
  intent_id: string;
  panda_id: string;
  locale: string;
  safe_return_path: string;
  status: string;
  expires_at: string;
}

function isPendingFollowResponse(value: unknown): value is PendingFollowResponse {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.handle === "string"
    && typeof item.continuation_handle === "string"
    && typeof item.intent_id === "string"
    && typeof item.panda_id === "string"
    && typeof item.safe_return_path === "string";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ detail: "Invalid request" }, { status: 400 });

  const existingHandle = await readPendingFollowHandle();
  const result = await callFastApiEngagement("/api/v1/follow-intents", {
    method: "POST",
    anonymous: true,
    body: {
      panda_id: payload.panda_id,
      locale: payload.locale,
      return_path: payload.return_path,
      existing_handle: existingHandle,
      request_id: crypto.randomUUID(),
    },
  });
  if (isNextResponse(result)) return result;
  if (!result.response.ok || !isPendingFollowResponse(result.body)) {
    return engagementJsonResponse(result);
  }

  await setPendingFollowCookies(result.body.handle, result.body.continuation_handle);
  return NextResponse.json(
    {
      intent_id: result.body.intent_id,
      panda_id: result.body.panda_id,
      locale: result.body.locale,
      safe_return_path: result.body.safe_return_path,
      status: result.body.status,
      expires_at: result.body.expires_at,
    },
    { status: result.response.status, headers: { "Cache-Control": "no-store, private" } },
  );
}

export async function GET() {
  const handle = await readPendingFollowHandle();
  if (!handle) return NextResponse.json({ detail: "Not found" }, { status: 404 });
  const result = await callFastApiEngagement("/api/v1/follow-intents/current", {
    anonymous: true,
    headers: { "X-Pending-Follow-Handle": handle },
  });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
