import "server-only";

import { V2_API_BASE_URL, v2Transport } from "@/lib/server/v2-api";
import { forwardToV2 } from "@/lib/server/v2-forwarding";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Every pass-through API route of the Web app; the route table in v2-forwarding.ts lists them.
function forward(request: Request): Promise<Response> {
  return forwardToV2(request, {
    baseUrl: V2_API_BASE_URL,
    transport: v2Transport,
    getAccessToken: getVerifiedSupabaseAccessToken,
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
