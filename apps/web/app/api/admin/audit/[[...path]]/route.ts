import { NextRequest } from "next/server";

import { proxyAdminAuditRequest } from "@/lib/server/fastapi-admin-audit-proxy";

export const dynamic = "force-dynamic";

interface AuditRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: AuditRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminAuditRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
