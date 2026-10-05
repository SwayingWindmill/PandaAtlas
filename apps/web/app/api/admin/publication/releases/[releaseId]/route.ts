import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ releaseId: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { releaseId } = await context.params;
  if (!releaseId.trim()) return NextResponse.json({ detail: "releaseId is required" }, { status: 400 });
  return v2JsonResponse(await api.client.GET("/api/v2/publication/releases/{releaseId}/inspection", {
    headers: api.headers,
    params: { path: { releaseId } },
  }));
}
