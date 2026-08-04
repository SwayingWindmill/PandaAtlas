import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTEXT_PATTERN = /^[a-z][a-z0-9_.-]{2,63}$/;

function isUuid(value: string | undefined): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

function isContext(value: string | undefined): boolean {
  return Boolean(value && CONTEXT_PATTERN.test(value));
}

function isAllowed(method: string, segments: string[]): boolean {
  if (method === "GET") {
    return (
      (segments.length === 1 && (segments[0] === "requests" || segments[0] === "metrics")) ||
      (segments.length === 2 && segments[0] === "requests" && isUuid(segments[1])) ||
      (segments.length === 3 &&
        segments[0] === "requests" &&
        isUuid(segments[1]) &&
        segments[2] === "holds")
    );
  }
  if (method !== "POST") return false;
  if (segments.length === 1 && segments[0] === "maintenance") return true;
  if (segments.length === 3 && segments[0] === "requests" && isUuid(segments[1])) {
    return ["verify", "generate-export", "execute-private-deletion", "finalize-account-deletion"].includes(
      segments[2] ?? "",
    );
  }
  if (
    segments.length === 4 &&
    segments[0] === "requests" &&
    isUuid(segments[1]) &&
    segments[2] === "contexts" &&
    isContext(segments[3])
  ) {
    return true;
  }
  if (
    segments.length === 4 &&
    segments[0] === "requests" &&
    isUuid(segments[1]) &&
    segments[2] === "holds" &&
    isContext(segments[3])
  ) {
    return true;
  }
  if (
    segments.length === 3 &&
    segments[0] === "holds" &&
    isUuid(segments[1]) &&
    segments[2] === "release"
  ) {
    return true;
  }
  return (
    segments.length === 4 &&
    segments[0] === "tombstones" &&
    isUuid(segments[1]) &&
    isContext(segments[2]) &&
    segments[3] === "replay"
  );
}

function privateHeaders(response: Response): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex, nofollow",
  });
  const authenticate = response.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  return headers;
}

export async function proxyAdminPrivacyRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  if (!isAllowed(request.method, pathSegments)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const path = pathSegments.map(encodeURIComponent).join("/");
  const target = `${FASTAPI_BASE_URL}/api/v1/admin/privacy/${path}${request.nextUrl.search}`;
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
    return NextResponse.json({ detail: "Privacy service unavailable" }, { status: 502 });
  }

  const responseBody = await response.text();
  const responseHeaders = privateHeaders(response);
  if (!responseBody) {
    return new NextResponse(null, { status: response.status, headers: responseHeaders });
  }
  try {
    return NextResponse.json(JSON.parse(responseBody), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "Invalid Privacy service response" },
      { status: 502, headers: responseHeaders },
    );
  }
}
