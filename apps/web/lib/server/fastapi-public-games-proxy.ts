import "server-only";

import { NextRequest, NextResponse } from "next/server";

const FASTAPI_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

export async function proxyPublicGameRequest(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  const headers = new Headers({ Accept: "application/json" });
  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    if (body) headers.set("Content-Type", request.headers.get("content-type") ?? "application/json");
  }
  try {
    const response = await fetch(
      `${FASTAPI_BASE_URL}/api/v1/games/guess/${path}${request.nextUrl.search}`,
      { method: request.method, headers, body, cache: "no-store" },
    );
    const responseBody = await response.text();
    if (!responseBody) return new NextResponse(null, { status: response.status });
    try {
      return NextResponse.json(JSON.parse(responseBody), { status: response.status });
    } catch {
      return NextResponse.json({ detail: "Invalid game response" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ detail: "Game service unavailable" }, { status: 502 });
  }
}
