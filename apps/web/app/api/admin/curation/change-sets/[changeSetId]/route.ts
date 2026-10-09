import { authenticationRequiredResponse, createAuthenticatedV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ changeSetId: string }> }) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { changeSetId } = await context.params;
  return v2JsonResponse(await api.client.GET("/api/v2/curation/change-sets/{changeSetId}", {
    headers: api.headers, params: { path: { changeSetId } },
  }));
}
