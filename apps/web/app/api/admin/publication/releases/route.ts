import type { components } from "@zhipanda/api-client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type BuildReleaseBody = components["schemas"]["BuildPublicReleaseDto"];

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const lifecycleState = request.nextUrl.searchParams.get("lifecycleState");

  return v2JsonResponse(await api.client.GET("/api/v2/publication/releases", {
    headers: api.headers,
    params: {
      query: {
        limit: Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 10,
        offset: Number.isInteger(offset) ? Math.max(0, offset) : 0,
        ...(lifecycleState === "building" || lifecycleState === "sealed" ? { lifecycleState } : {}),
      },
    },
  }));
}

export async function POST(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const input = await request.json().catch(() => null) as BuildReleaseBody | null;
  if (!input?.version?.trim()) {
    return NextResponse.json({ detail: "version is required" }, { status: 400 });
  }
  return v2JsonResponse(await api.client.POST("/api/v2/publication/releases", {
    headers: api.headers,
    body: { version: input.version.trim() },
  }));
}
