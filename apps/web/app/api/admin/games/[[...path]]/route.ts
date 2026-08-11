import { NextRequest } from "next/server";

import { proxyAdminGamesRequest } from "@/lib/server/fastapi-admin-games-proxy";

export const dynamic = "force-dynamic";

interface AdminGamesRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: AdminGamesRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminGamesRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
