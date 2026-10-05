import type { components } from "@zhipanda/api-client";
import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

type PublicationReasonBody = components["schemas"]["PublicationReasonDto"];
type PublicationAction = "seal" | "activate" | "rollback" | "suspend" | "restore";

interface RouteContext {
  params: Promise<{ releaseId: string }>;
}

interface PublicationActionRequest extends PublicationReasonBody {
  action: PublicationAction;
}

export async function POST(request: Request, context: RouteContext) {
  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();
  const { releaseId } = await context.params;
  const input = await request.json().catch(() => null) as PublicationActionRequest | null;
  if (!input || !["seal", "activate", "rollback", "suspend", "restore"].includes(input.action)) {
    return NextResponse.json({ detail: "supported action is required" }, { status: 400 });
  }
  const reason = input.reason?.trim();
  if (!reason || reason.length < 3) {
    return NextResponse.json({ detail: "reason must contain at least three characters" }, { status: 400 });
  }
  const body = { reason };
  switch (input.action) {
    case "seal":
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/seal", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
    case "activate":
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/activate", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
    case "rollback":
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/rollback", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
    case "suspend":
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/suspend", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
    case "restore":
      return v2JsonResponse(await api.client.POST("/api/v2/publication/releases/{releaseId}/restore", {
        headers: api.headers,
        params: { path: { releaseId } },
        body,
      }));
  }
}
