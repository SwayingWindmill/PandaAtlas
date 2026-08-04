import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowed(method: string, segments: string[]): boolean {
  const path = segments.join("/");
  if (method === "GET") {
    if (["events", "metrics", "integrity-summaries"].includes(path)) return true;
    return (
      segments.length === 3 &&
      segments[0] === "exports" &&
      UUID_PATTERN.test(segments[1] ?? "") &&
      segments[2] === "download"
    );
  }
  if (method === "POST") {
    if (["exports", "integrity-summaries", "maintenance/retention"].includes(path)) return true;
    return (
      segments.length === 3 &&
      segments[0] === "integrity-summaries" &&
      UUID_PATTERN.test(segments[1] ?? "") &&
      segments[2] === "verify"
    );
  }
  return false;
}

function privateHeaders(response: Response): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  });
  for (const name of [
    "content-type",
    "content-disposition",
    "x-audit-file-sha256",
    "www-authenticate",
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export async function proxyAdminAuditRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  if (!isAllowed(request.method, pathSegments)) {
    return NextResponse.json({ detail: "Unsupported Audit operation" }, { status: 404 });
  }
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } },
    );
  }

  const path = pathSegments.map(encodeURIComponent).join("/");
  const target = `${FASTAPI_BASE_URL}/api/v1/admin/audit/${path}${request.nextUrl.search}`;
  const headers = new Headers({
    Accept: "application/json, application/x-ndjson",
    Authorization: `Bearer ${accessToken}`,
    "X-Correlation-Id": crypto.randomUUID(),
  });
  let body: string | undefined;
  if (request.method === "POST") {
    body = await request.text();
    if (body) headers.set("Content-Type", "application/json");
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
    return NextResponse.json({ detail: "Audit service unavailable" }, { status: 502 });
  }

  const responseHeaders = privateHeaders(response);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    if (!text) return new NextResponse(null, { status: response.status, headers: responseHeaders });
    try {
      return NextResponse.json(JSON.parse(text), {
        status: response.status,
        headers: responseHeaders,
      });
    } catch {
      return NextResponse.json(
        { detail: "Invalid Audit service response" },
        { status: 502, headers: responseHeaders },
      );
    }
  }
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: responseHeaders,
  });
}
