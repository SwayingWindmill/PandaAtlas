import type { components } from "@zhipanda/api-client";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type ApplySanctionBody = components["schemas"]["ApplySanctionDto"];

interface RouteContext {
  params: Promise<{ accountId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { accountId } = await context.params;
  const input = await request.json() as ApplySanctionBody;
  return v2JsonResponse(await api.client.POST("/api/v2/moderation/accounts/{accountId}/sanctions", {
    headers: api.headers,
    params: { path: { accountId } },
    body: input,
  }));
}
