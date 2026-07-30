import {
  callFastApiCommunityIntake,
  communityIntakeJsonResponse,
  isCommunityNextResponse,
} from "@/lib/server/fastapi-community-intake-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await callFastApiCommunityIntake("/api/v1/me/contribution-analytics");
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}
