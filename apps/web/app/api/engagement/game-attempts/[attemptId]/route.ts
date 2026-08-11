import { callFastApiEngagement, engagementJsonResponse, isNextResponse } from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface GameAttemptRouteContext {
  params: Promise<{ attemptId: string }>;
}

export async function DELETE(_request: Request, context: GameAttemptRouteContext) {
  const { attemptId } = await context.params;
  const result = await callFastApiEngagement(
    `/api/v1/me/game-attempts/${encodeURIComponent(attemptId)}`,
    { method: "DELETE" },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
