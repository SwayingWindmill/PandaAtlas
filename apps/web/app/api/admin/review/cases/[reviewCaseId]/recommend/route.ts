import type { components } from "@zhipanda/api-client";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type RecommendBody = components["schemas"]["RecommendReviewDto"];

interface RouteContext {
  params: Promise<{ reviewCaseId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { reviewCaseId } = await context.params;
  const input = await request.json() as RecommendBody;
  return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/recommend", {
    headers: api.headers,
    params: { path: { reviewCaseId } },
    body: input,
  }));
}
