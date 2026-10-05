import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";
import { APPEAL_STATES, type AppealState } from "@/features/admin/review-moderation/api/types";

export const dynamic = "force-dynamic";

const appealStates = new Set<AppealState>(APPEAL_STATES);

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const state = request.nextUrl.searchParams.get("state") as AppealState | null;
  return v2JsonResponse(await api.client.GET("/api/v2/moderation/appeals", {
    headers: api.headers,
    params: {
      query: {
        limit: Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 25,
        offset: Number.isInteger(offset) ? Math.max(0, offset) : 0,
        ...(state && appealStates.has(state) ? { state } : {}),
      },
    },
  }));
}
