import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.GET("/api/v2/me/game-attempts", {
      headers: api.headers,
    }),
  );
}

export async function POST(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const body = (await request.json()) as {
    questionId: string;
    selectedPandaId: string;
  };

  return v2JsonResponse(
    await api.client.POST("/api/v2/me/game-attempts", {
      headers: api.headers,
      body,
    }),
  );
}
