import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiCommunityIntake,
  communityIntakeJsonResponse,
  isCommunityNextResponse,
} from "@/lib/server/fastapi-community-intake-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const query = request.nextUrl.searchParams.toString();
  const result = await callFastApiCommunityIntake(
    `/api/v1/me/submissions${query ? `?${query}` : ""}`,
  );
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const result = await callFastApiCommunityIntake("/api/v1/me/submissions/drafts", {
    method: "POST",
    body,
  });
  return isCommunityNextResponse(result) ? result : communityIntakeJsonResponse(result);
}
