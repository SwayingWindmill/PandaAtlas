import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface FavoriteRouteContext {
  params: Promise<{ pandaId: string }>;
}

export async function POST(_request: NextRequest, context: FavoriteRouteContext) {
  const { pandaId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.POST("/api/v2/me/favorites/{pandaId}", {
      params: { path: { pandaId } },
      headers: api.headers,
    }),
  );
}

export async function DELETE(_request: NextRequest, context: FavoriteRouteContext) {
  const { pandaId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.DELETE("/api/v2/me/favorites/{pandaId}", {
      params: { path: { pandaId } },
      headers: api.headers,
    }),
  );
}
