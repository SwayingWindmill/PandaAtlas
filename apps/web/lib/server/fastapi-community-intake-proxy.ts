import "server-only";

import { NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

interface CommunityIntakeProxyOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

export interface CommunityIntakeProxyResult {
  response: Response;
  body: unknown;
}

export async function callFastApiCommunityIntake(
  path: string,
  options: CommunityIntakeProxyOptions = {},
): Promise<CommunityIntakeProxyResult | NextResponse> {
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  if (options.body !== undefined && options.formData !== undefined) {
    return NextResponse.json({ detail: "Invalid proxy request" }, { status: 500 });
  }

  let response: Response;
  try {
    response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
        "X-Correlation-Id": crypto.randomUUID(),
      },
      body:
        options.formData !== undefined
          ? options.formData
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Community contribution service unavailable" },
      { status: 502 },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (response.status !== 204) {
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ detail: "Invalid contribution service response" }, { status: 502 });
    }
    try {
      body = await response.json();
    } catch {
      return NextResponse.json({ detail: "Invalid contribution service response" }, { status: 502 });
    }
  }
  return { response, body };
}

export function communityIntakeJsonResponse(result: CommunityIntakeProxyResult): NextResponse {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  });
  const authenticate = result.response.headers.get("www-authenticate");
  const etag = result.response.headers.get("etag");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  if (etag) headers.set("ETag", etag);
  if (result.body === null) {
    return new NextResponse(null, { status: result.response.status, headers });
  }
  return NextResponse.json(result.body, { status: result.response.status, headers });
}

export function isCommunityNextResponse(
  value: CommunityIntakeProxyResult | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
