import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface CheckinRouteContext {
  params: Promise<{ checkinId: string }>;
}

export async function DELETE(_request: Request, context: CheckinRouteContext) {
  const { checkinId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.DELETE("/api/v2/me/checkins/{checkinId}", {
      params: { path: { checkinId } },
      headers: api.headers,
    }),
  );
}
