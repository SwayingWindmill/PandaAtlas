import { NextRequest } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface CollectionRouteContext {
  params: Promise<{ collectionId: string }>;
}

function pathFor(collectionId: string): string {
  return `/api/v1/me/collections/${encodeURIComponent(collectionId)}`;
}

export async function PATCH(request: NextRequest, context: CollectionRouteContext) {
  const { collectionId } = await context.params;
  const body = await request.json();
  const result = await callFastApiEngagement(pathFor(collectionId), {
    method: "PATCH",
    body,
  });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function DELETE(_request: NextRequest, context: CollectionRouteContext) {
  const { collectionId } = await context.params;
  const result = await callFastApiEngagement(pathFor(collectionId), { method: "DELETE" });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
