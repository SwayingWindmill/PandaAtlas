import { NextRequest } from "next/server";

import { proxyAdminReviewRequest } from "@/lib/server/fastapi-admin-review-proxy";

export const dynamic = "force-dynamic";

interface ReviewRouteContext {
  params: Promise<{ path?: string[] }>;
}

async function proxy(request: NextRequest, context: ReviewRouteContext) {
  const { path = [] } = await context.params;
  return proxyAdminReviewRequest(request, path);
}

export const GET = proxy;
export const POST = proxy;
