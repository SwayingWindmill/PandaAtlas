import "server-only";

import { NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

interface EngagementProxyOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  anonymous?: boolean;
  headers?: Record<string, string>;
}

export interface EngagementProxyResult {
  response: Response;
  body: unknown;
}

export async function callFastApiEngagement(
  path: string,
  options: EngagementProxyOptions = {},
): Promise<EngagementProxyResult | NextResponse> {
  const accessToken = options.anonymous ? null : await getVerifiedSupabaseAccessToken();
  if (!options.anonymous && !accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "X-Correlation-Id": crypto.randomUUID(),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Engagement service unavailable" }, { status: 502 });
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ detail: "Invalid engagement service response" }, { status: 502 });
    }
  }
  return { response, body };
}

export function engagementJsonResponse(result: EngagementProxyResult): NextResponse {
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  const authenticate = result.response.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  if (result.body === null) {
    return new NextResponse(null, { status: result.response.status, headers });
  }
  return NextResponse.json(result.body, { status: result.response.status, headers });
}

export function isNextResponse(value: EngagementProxyResult | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
