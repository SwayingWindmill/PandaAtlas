import "server-only";

import { NextResponse } from "next/server";

const ADMIN_PROXY_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

const LOCAL_ENVIRONMENTS = new Set(["development", "dev", "local", "test"]);
const LOCAL_ADMIN_PROXY_BIND_HOST = "127.0.0.1";
const UNSUPPORTED_PROXY_HEADERS = ["cf-connecting-ip", "forwarded", "true-client-ip"] as const;
const FORWARDED_IP_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

function jsonDetail(detail: string, status: number) {
  return NextResponse.json({ detail }, { status });
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true" || value?.trim() === "1";
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function hostnameFromHostHeader(host: string): string {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return "";
  }
}

function isLoopbackAddress(value: string): boolean {
  const normalized = value.trim().replace(/^"|"$/g, "").toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "::ffff:127.0.0.1";
}

function hasUnsafeForwardingMetadata(request: Request): boolean {
  if (UNSUPPORTED_PROXY_HEADERS.some((header) => request.headers.has(header))) {
    return true;
  }

  for (const header of FORWARDED_IP_HEADERS) {
    const value = request.headers.get(header);
    if (value && value.split(",").some((address) => !isLoopbackAddress(address))) {
      return true;
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (
    forwardedHost &&
    forwardedHost.split(",").some((host) => !isLoopbackHostname(hostnameFromHostHeader(host.trim())))
  ) {
    return true;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto && forwardedProto.split(",").some((protocol) => !["http", "https"].includes(protocol.trim()))) {
    return true;
  }

  const forwardedPort = request.headers.get("x-forwarded-port");
  return Boolean(forwardedPort && forwardedPort.split(",").some((port) => !/^\d{1,5}$/.test(port.trim())));
}

function assertLocalAdminProxyAccess(request: Request): NextResponse | null {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV ?? nodeEnv).trim().toLowerCase();
  const bindHost = (process.env.LOCAL_ADMIN_PROXY_BIND_HOST ?? "").trim();
  if (
    nodeEnv === "production" ||
    !isEnabled(process.env.ENABLE_LOCAL_ADMIN_PROXY) ||
    !LOCAL_ENVIRONMENTS.has(appEnv) ||
    bindHost !== LOCAL_ADMIN_PROXY_BIND_HOST
  ) {
    return jsonDetail("Not found", 404);
  }

  if (hasUnsafeForwardingMetadata(request)) {
    return jsonDetail("Forwarded admin proxy requests are not allowed", 403);
  }

  const requestUrl = new URL(request.url);
  const hostHeader = request.headers.get("host");
  const hostHeaderName = hostHeader ? hostnameFromHostHeader(hostHeader) : requestUrl.hostname;
  if (!isLoopbackHostname(requestUrl.hostname) || !isLoopbackHostname(hostHeaderName)) {
    return jsonDetail("The admin proxy is restricted to the local machine", 403);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== requestUrl.origin) {
        return jsonDetail("Cross-origin admin requests are not allowed", 403);
      }
    } catch {
      return jsonDetail("Invalid request origin", 403);
    }
  }

  return null;
}

export async function proxyAdminRequest(
  request: Request,
  path: string,
  method: "GET" | "POST",
) {
  const accessError = assertLocalAdminProxyAccess(request);
  if (accessError) {
    return accessError;
  }

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

  if (method !== "GET") {
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
