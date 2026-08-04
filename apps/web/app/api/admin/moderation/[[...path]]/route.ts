import { NextRequest } from "next/server";

import { proxyAdminModerationRequest } from "@/lib/server/fastapi-admin-moderation-proxy";

export const dynamic = "force-dynamic";

interface ModerationRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: ModerationRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminModerationRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
