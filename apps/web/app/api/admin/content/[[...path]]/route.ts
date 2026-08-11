import { NextRequest } from "next/server";

import { proxyAdminContentRequest } from "@/lib/server/fastapi-admin-content-proxy";

export const dynamic = "force-dynamic";

interface AdminContentRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: AdminContentRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminContentRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
