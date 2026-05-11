import type { DistributionLayer, PandaGender, PandaStatus } from "./types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400"
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function errorResponse(status: number, detail: string): Response {
  return jsonResponse({ detail }, status);
}

export function parseIntegerParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = params.get(name);
  if (raw === null || raw === "") {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(422, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function parseBooleanParam(params: URLSearchParams, name: string): boolean | null {
  const raw = params.get(name);
  if (raw === null || raw === "") {
    return null;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  throw new HttpError(422, `${name} must be a boolean`);
}

export function parsePandaStatus(value: string | null): PandaStatus | null {
  if (value === null || value === "") {
    return null;
  }
  if (value === "alive" || value === "deceased" || value === "unknown") {
    return value;
  }
  throw new HttpError(422, "status must be alive, deceased, or unknown");
}

export function parsePandaGender(value: string | null): PandaGender | null {
  if (value === null || value === "") {
    return null;
  }
  if (value === "male" || value === "female" || value === "unknown") {
    return value;
  }
  throw new HttpError(422, "gender must be male, female, or unknown");
}

export function parseDistributionLayer(value: string | null): DistributionLayer | null {
  if (value === null || value === "") {
    return null;
  }
  if (value === "wild" || value === "captive" || value === "protected_area" || value === "corridor") {
    return value;
  }
  throw new HttpError(422, "layer must be wild, captive, protected_area, or corridor");
}

export function nowIso(): string {
  return new Date().toISOString();
}
