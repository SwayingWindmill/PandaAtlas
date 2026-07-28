import { NextRequest } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface FollowRouteContext {
  params: Promise<{ pandaId: string }>;
}

export async function GET(_request: NextRequest, context: FollowRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(
    `/api/v1/me/follows/${encodeURIComponent(pandaId)}`,
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function POST(_request: NextRequest, context: FollowRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(
    `/api/v1/me/follows/${encodeURIComponent(pandaId)}`,
    {
      method: "POST",
      body: { idempotency_key: `follow-${crypto.randomUUID()}` },
    },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function DELETE(_request: NextRequest, context: FollowRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(
    `/api/v1/me/follows/${encodeURIComponent(pandaId)}`,
    {
      method: "DELETE",
      headers: { "Idempotency-Key": `unfollow-${crypto.randomUUID()}` },
    },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
