import { NextRequest, NextResponse } from "next/server";

import {
  callFastApiEngagement,
  engagementJsonResponse,
  isNextResponse,
} from "@/lib/server/fastapi-engagement-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  if (cursor && (cursor.length < 8 || cursor.length > 2048)) {
    return NextResponse.json({ detail: "Invalid Inbox cursor" }, { status: 400 });
  }
  const query = new URLSearchParams({ page_size: "20" });
  if (cursor) query.set("cursor", cursor);
  const result = await callFastApiEngagement(`/api/v1/me/inbox?${query}`);
  return isNextResponse(result) ? result : engagementJsonResponse(result);
}
