import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface SubmissionRouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function GET(_request: Request, context: SubmissionRouteContext) {
  const { submissionId } = await context.params;
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/contributions/{submissionId}", {
      params: { path: { submissionId } },
      headers: api.headers,
    }),
  );
}
