import { NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const result = await callFastApiEngagement("/api/v1/me/feed/last-viewed", {
    method: "POST",
    body,
  });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
