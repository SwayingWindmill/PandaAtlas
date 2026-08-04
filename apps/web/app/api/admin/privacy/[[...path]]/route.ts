import { NextRequest } from "next/server";

import { proxyAdminPrivacyRequest } from "@/lib/server/fastapi-admin-privacy-proxy";

export const dynamic = "force-dynamic";

interface PrivacyRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: PrivacyRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminPrivacyRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
