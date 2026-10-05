import type { components } from "@zhipanda/api-client";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type RestoreSanctionBody = components["schemas"]["RestoreSanctionDto"];

interface RouteContext {
  params: Promise<{ sanctionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { sanctionId } = await context.params;
  const input = await request.json() as RestoreSanctionBody;
  return v2JsonResponse(await api.client.POST("/api/v2/moderation/sanctions/{sanctionId}/restore", {
    headers: api.headers,
    params: { path: { sanctionId } },
    body: input,
  }));
}
