import type { components } from "@zhipanda/api-client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type OpenReviewCaseBody = components["schemas"]["OpenReviewCaseDto"];
type ReviewState = "new" | "triage" | "assigned" | "waiting" | "decision_ready" | "incorporation_recommended" | "closed";

const reviewStates = new Set<ReviewState>([
  "new",
  "triage",
  "assigned",
  "waiting",
  "decision_ready",
  "incorporation_recommended",
  "closed",
]);

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const state = request.nextUrl.searchParams.get("state") as ReviewState | null;
  return v2JsonResponse(await api.client.GET("/api/v2/review/cases", {
    headers: api.headers,
    params: {
      query: {
        limit: Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 25,
        offset: Number.isInteger(offset) ? Math.max(0, offset) : 0,
        ...(state && reviewStates.has(state) ? { state } : {}),
      },
    },
  }));
}

export async function POST(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const input = await request.json().catch(() => null) as OpenReviewCaseBody | null;
  if (!input?.submissionId) {
    return NextResponse.json({ detail: "submissionId is required" }, { status: 400 });
  }
  return v2JsonResponse(await api.client.POST("/api/v2/review/cases", {
    headers: api.headers,
    body: input,
  }));
}
