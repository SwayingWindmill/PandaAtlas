import "server-only";

import { createApiClient, type ApiClient } from "@zhipanda/api-client";
import { NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const V2_API_BASE_URL = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const API_PROTECTION_BYPASS_SECRET = process.env.API_PROTECTION_BYPASS_SECRET?.trim();

export interface AuthenticatedV2Client {
  client: ApiClient;
  headers: {
    Authorization: string;
    "X-Correlation-Id": string;
  };
}

interface V2Result {
  data?: unknown;
  error?: unknown;
  response: Response;
}

export function createServerV2Client(): ApiClient {
  const client = createApiClient(V2_API_BASE_URL);
  if (API_PROTECTION_BYPASS_SECRET) {
    client.use({
      onRequest({ request }) {
        request.headers.set("x-vercel-protection-bypass", API_PROTECTION_BYPASS_SECRET);
        return request;
      },
    });
  }
  return client;
}

export async function createAuthenticatedV2Client(): Promise<AuthenticatedV2Client | null> {
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) return null;

  return {
    client: createServerV2Client(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Correlation-Id": crypto.randomUUID(),
    },
  };
}

export function authenticationRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      type: "about:blank",
      title: "Authentication required",
      status: 401,
      detail: "Authentication is required for this operation.",
    },
    { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store, private" } },
  );
}

export function v2JsonResponse(result: V2Result): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  const authenticate = result.response.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);

  const body = result.data ?? result.error ?? null;
  if (body === null || result.response.status === 204) {
    return new NextResponse(null, { status: result.response.status, headers });
  }
  return NextResponse.json(body, { status: result.response.status, headers });
}
