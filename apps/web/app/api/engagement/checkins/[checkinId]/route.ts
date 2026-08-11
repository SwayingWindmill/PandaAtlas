import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

interface CheckinRouteContext {
  params: Promise<{ checkinId: string }>;
}

export async function DELETE(_request: Request, context: CheckinRouteContext) {
  const { checkinId } = await context.params;
  const result = await callFastApiEngagement(
    `/api/v1/me/checkins/${encodeURIComponent(checkinId)}`,
    { method: "DELETE" },
  );
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
