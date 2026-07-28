import "server-only";

import { NextResponse } from "next/server";

import { getVerifiedSupabaseAccessToken } from "@/lib/supabase/server";

const FASTAPI_BASE_URL = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export async function proxyFastApiSession(path: "/api/v1/identity/session" | "/api/v1/admin/session") {
  const accessToken = await getVerifiedSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Authentication required" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${FASTAPI_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Correlation-Id": crypto.randomUUID(),
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Identity service unavailable" }, { status: 502 });
  }

  const body = await response.text();
  const headers = new Headers({ "Cache-Control": "no-store, private" });
  const authenticate = response.headers.get("www-authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);

  if (!body) {
    return new NextResponse(null, { status: response.status, headers });
  }
  try {
    return NextResponse.json(JSON.parse(body), { status: response.status, headers });
  } catch {
    return NextResponse.json({ detail: "Invalid identity service response" }, { status: 502, headers });
  }
}
