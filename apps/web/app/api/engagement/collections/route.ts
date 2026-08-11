import { NextRequest } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await callFastApiEngagement("/api/v1/me/collections");
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await callFastApiEngagement("/api/v1/me/collections", {
    method: "POST",
    body,
  });
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
