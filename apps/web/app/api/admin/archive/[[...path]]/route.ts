import { NextRequest } from "next/server";

import { proxyAdminArchiveRequest } from "@/lib/server/fastapi-admin-archive-proxy";

export const dynamic = "force-dynamic";

interface ArchiveRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: ArchiveRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminArchiveRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
