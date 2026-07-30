import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

function privateHeaders(response: Response): Headers {
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  const authenticate = response.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  return headers;
}

export async function proxyAdminReviewRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const path = pathSegments.map(encodeURIComponent).join("/");
  const query = request.nextUrl.search;
  const target = `${FASTAPI_BASE_URL}/api/v1/admin/review-cases${path ? `/${path}` : ""}${query}`;
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-Correlation-Id": crypto.randomUUID(),
  });
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    if (body) headers.set("Content-Type", request.headers.get("content-type") ?? "application/json");
  }

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Review service unavailable" }, { status: 502 });
  }

  const responseBody = await response.text();
  const responseHeaders = privateHeaders(response);
  if (!responseBody) return new NextResponse(null, { status: response.status, headers: responseHeaders });
  try {
    return NextResponse.json(JSON.parse(responseBody), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "Invalid review service response" },
      { status: 502, headers: responseHeaders },
    );
  }
}
