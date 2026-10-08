import type { components } from "@zhipanda/api-client";
import { authenticationRequiredResponse, createAuthenticatedV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { accountId } = await context.params;
  const body = await request.json() as components["schemas"]["GrantStaffRoleDto"];
  return v2JsonResponse(await api.client.POST("/api/v2/staff/accounts/{accountId}/roles", {
    headers: api.headers, params: { path: { accountId } }, body,
  }));
}
