import type { components } from "@zhipanda/api-client";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type DecideAppealBody = components["schemas"]["DecideAppealDto"];

interface RouteContext {
  params: Promise<{ appealCaseId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { appealCaseId } = await context.params;
  const input = await request.json() as DecideAppealBody;
  return v2JsonResponse(await api.client.POST("/api/v2/moderation/appeals/{appealCaseId}/decision", {
    headers: api.headers,
    params: { path: { appealCaseId } },
    body: input,
  }));
}
