import { NextRequest } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface CollectionPandaRouteContext {
  params: Promise<{ collectionId: string; pandaId: string }>;
}

function pathFor(collectionId: string, pandaId: string): string {
  return `/api/v1/me/collections/${encodeURIComponent(collectionId)}/pandas/${encodeURIComponent(pandaId)}`;
}

export async function POST(_request: NextRequest, context: CollectionPandaRouteContext) {
  const { collectionId, pandaId } = await context.params;
  const result = await callFastApiEngagement(pathFor(collectionId, pandaId), { method: "POST" });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function DELETE(_request: NextRequest, context: CollectionPandaRouteContext) {
  const { collectionId, pandaId } = await context.params;
  const result = await callFastApiEngagement(pathFor(collectionId, pandaId), { method: "DELETE" });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
