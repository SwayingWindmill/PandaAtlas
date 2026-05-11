import "server-only";

import { NextResponse } from "next/server";

const ADMIN_PROXY_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

function jsonDetail(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

export async function proxyAdminRequest(
  path: string,
  method: "GET" | "POST",
  request?: Request,
) {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  if (!token) {
    return jsonDetail("ADMIN_API_TOKEN is not configured for the web admin proxy", 503);
  }

  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (request && method !== "GET") {
    const body = await request.text();
    if (body) {
      headers["Content-Type"] = "application/json";
      init.body = body;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${ADMIN_PROXY_BASE_URL}${path}`, init);
  } catch {
    return jsonDetail("Failed to reach admin API", 502);
  }

  const raw = await response.text();
  if (!raw) {
    return new NextResponse(null, { status: response.status });
  }

  try {
    return NextResponse.json(JSON.parse(raw), { status: response.status });
  } catch {
    return jsonDetail(raw, response.status);
  }
}
