import { NextRequest } from "next/server";

import { proxyAdminMediaRequest } from "@/lib/server/fastapi-admin-media-proxy";

export const dynamic = "force-dynamic";

interface AdminMediaRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: AdminMediaRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminMediaRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
