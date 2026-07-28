import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await callFastApiEngagement("/api/v1/me/passport");
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
