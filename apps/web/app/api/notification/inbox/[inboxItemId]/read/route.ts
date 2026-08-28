import { NextResponse } from "next/server";

import {
  authenticationRequiredResponse,
  createAuthenticatedV2Client,
  v2JsonResponse,
} from "@/lib/server/v2-api";

export const dynamic = "force-dynamic";

interface InboxReadContext {
  params: Promise<{ inboxItemId: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(_request: Request, context: InboxReadContext) {
  const { inboxItemId } = await context.params;
  if (!UUID_PATTERN.test(inboxItemId)) {
    return NextResponse.json({ detail: "Invalid inbox item" }, { status: 400 });
  }

  const api = await createAuthenticatedV2Client();
  if (!api) return authenticationRequiredResponse();

  return v2JsonResponse(
    await api.client.PATCH("/api/v2/me/notifications/{messageId}/read", {
      params: { path: { messageId: inboxItemId } },
      headers: api.headers,
    }),
  );
}
