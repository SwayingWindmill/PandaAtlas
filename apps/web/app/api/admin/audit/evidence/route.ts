import { NextRequest } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  const rawLimit = request.nextUrl.searchParams.get("limit");

  return v2JsonResponse(await api.client.GET("/api/v2/audit/evidence", {
    headers: api.headers,
    params: {
      query: rawLimit === null ? {} : { limit: Number(rawLimit) },
    },
  }));
}
