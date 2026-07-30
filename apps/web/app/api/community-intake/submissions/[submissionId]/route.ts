import { NextRequest } from "next/server";

import {
  callFastApiCommunityIntake,
  communityIntakeJsonResponse,
  isCommunityNextResponse,
} from "@/lib/server/fastapi-community-intake-proxy";

export const dynamic = "force-dynamic";

interface SubmissionRouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function GET(_request: NextRequest, context: SubmissionRouteContext) {
  const { submissionId } = await context.params;
  const result = await callFastApiCommunityIntake(
    `/api/v1/me/submissions/${encodeURIComponent(submissionId)}`,
  );
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}
