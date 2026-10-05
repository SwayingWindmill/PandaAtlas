import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reviewCaseId: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { reviewCaseId } = await context.params;
  return v2JsonResponse(await api.client.POST("/api/v2/review/cases/{reviewCaseId}/claim", {
    headers: api.headers,
    params: { path: { reviewCaseId } },
  }));
}
