import { authenticationRequiredResponse, createAuthenticatedV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ accountId: string }> }) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { accountId } = await context.params;
  return v2JsonResponse(await api.client.GET("/api/v2/staff/accounts/{accountId}", {
    headers: api.headers,
    params: { path: { accountId } },
  }));
}
