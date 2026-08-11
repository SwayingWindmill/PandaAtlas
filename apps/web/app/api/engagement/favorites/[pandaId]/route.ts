import { NextRequest } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface FavoriteRouteContext {
  params: Promise<{ pandaId: string }>;
}

function pathFor(pandaId: string): string {
  return `/api/v1/me/favorites/${encodeURIComponent(pandaId)}`;
}

export async function GET(_request: NextRequest, context: FavoriteRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(pathFor(pandaId));
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function POST(_request: NextRequest, context: FavoriteRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(pathFor(pandaId), { method: "POST" });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function DELETE(_request: NextRequest, context: FavoriteRouteContext) {
  const { pandaId } = await context.params;
  const result = await callFastApiEngagement(pathFor(pandaId), { method: "DELETE" });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
