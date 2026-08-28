import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface CollectionRouteContext {
  params: Promise<{ collectionId: string }>;
}

export async function PATCH(request: NextRequest, context: CollectionRouteContext) {
  const { collectionId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const body = (await request.json()) as { name: string };

  return v2JsonResponse(
    await api.client.PATCH("/api/v2/me/collections/{collectionId}", {
      params: { path: { collectionId } },
      headers: api.headers,
      body,
    }),
  );
}

export async function DELETE(_request: NextRequest, context: CollectionRouteContext) {
  const { collectionId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.DELETE("/api/v2/me/collections/{collectionId}", {
      params: { path: { collectionId } },
      headers: api.headers,
    }),
  );
}
