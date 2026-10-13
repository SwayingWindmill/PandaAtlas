import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export async function POST() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  return v2JsonResponse(await api.client.POST("/api/v2/me/staff-invitation/accept", {
    headers: api.headers,
  }));
}
