import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await createAuthenticatedV2Client();
  if (!context) return authenticationRequiredResponse();

  return v2JsonResponse(
    await context.client.GET("/api/v2/me/favorites", {
      headers: context.headers,
    }),
  );
}
