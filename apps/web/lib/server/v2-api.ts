import "server-only";

import { createApiClient, type ApiClient } from "@zhipanda/api-client";
import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

import { sessionRequiredResponse } from "@/lib/server/v2-forwarding";
import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

export const V2_API_BASE_URL = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

// The Web Worker reaches the API over its service binding; everywhere else over the network.
export function v2Transport(request: Request): Promise<Response> {
  if (process.env.API_TRANSPORT === "service-binding") {
    return env.V2_API.fetch(request);
  }
  return fetch(request);
}

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
  return createApiClient(V2_API_BASE_URL, v2Transport);
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

export function authenticationRequiredResponse(): Response {
  return sessionRequiredResponse();
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
