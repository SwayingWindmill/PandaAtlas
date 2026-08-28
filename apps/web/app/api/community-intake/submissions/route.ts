import type { components } from "@zhipanda/api-client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type SubmitContributionBody = components["schemas"]["SubmitContributionDto"];

export async function GET() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/contributions", {
      headers: api.headers,
    }),
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const body = await request.json().catch(() => null) as SubmitContributionBody | null;
  if (!body) return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });

  return v2JsonResponse(
    await api.client.POST("/api/v2/contributions", {
      headers: api.headers,
      body,
    }),
  );
}
