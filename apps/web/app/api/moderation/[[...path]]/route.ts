import { NextRequest } from "next/server";

import { proxyModerationRequest } from "@/lib/server/fastapi-moderation-proxy";

export const dynamic = "force-dynamic";

interface ModerationRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: ModerationRouteContext) {
  const { path = [] } = await context.params;
  return proxyModerationRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
