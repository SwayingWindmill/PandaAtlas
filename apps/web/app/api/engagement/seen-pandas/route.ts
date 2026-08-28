import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/seen-pandas", {
      headers: api.headers,
    }),
  );
}
