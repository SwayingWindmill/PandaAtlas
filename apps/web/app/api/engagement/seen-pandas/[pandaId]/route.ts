import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface SeenPandaRouteContext {
  params: Promise<{ pandaId: string }>;
}

export async function GET(_request: NextRequest, context: SeenPandaRouteContext) {
  const { pandaId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/seen-pandas/{pandaId}", {
      params: { path: { pandaId } },
      headers: api.headers,
    }),
  );
}

export async function PUT(request: NextRequest, context: SeenPandaRouteContext) {
  const { pandaId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const body = (await request.json()) as {
    seenOn?: string | null;
    placeId?: string | null;
    note?: string | null;
  };

  return v2JsonResponse(
    await api.client.PUT("/api/v2/me/seen-pandas/{pandaId}", {
      params: { path: { pandaId } },
      headers: api.headers,
      body,
    }),
  );
}

export async function DELETE(_request: NextRequest, context: SeenPandaRouteContext) {
  const { pandaId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.DELETE("/api/v2/me/seen-pandas/{pandaId}", {
      params: { path: { pandaId } },
      headers: api.headers,
    }),
  );
}
