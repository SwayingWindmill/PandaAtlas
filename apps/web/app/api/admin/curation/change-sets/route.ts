import { NextRequest } from "next/server";
import { authenticationRequiredResponse, createAuthenticatedV2Client, v2JsonResponse } from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const params = request.nextUrl.searchParams;
  return v2JsonResponse(await api.client.GET("/api/v2/curation/change-sets", {
    headers: api.headers,
    params: { query: {
      limit: Number(params.get("limit") ?? 10),
      offset: Number(params.get("offset") ?? 0),
      ...(params.has("state") ? { state: params.get("state") as "draft" | "validated" | "approved" | "applied" | "rejected" } : {}),
    } },
  }));
}
