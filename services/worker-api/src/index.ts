import type { Env } from "./bindings";
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  parseBooleanParam,
  parseDistributionLayer,
  parseIntegerParam,
  parsePandaGender,
  parsePandaStatus
} from "./http";
import { parseBBox } from "./geo";
import { assertAdminRequest, createImportJob, getImportJob, listImportSources, runImportJob } from "./repositories/admin";
import { getDistribution, getHabitats, listDistributionSnapshots } from "./repositories/map";
import { getPandaDetail, getPandaLineage, listPandas } from "./repositories/pandas";
import { getOverviewStats } from "./repositories/stats";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    try {
      return await routeRequest(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.status, error.message);
      }
      return errorResponse(500, error instanceof Error ? error.message : "Internal server error");
    }
  }
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    const db = await databaseHealth(env);
    return jsonResponse({ status: "ok", version: "0.1.0-cloudflare", db });
  }

  if (request.method === "GET" && path === "/api/v1/pandas") {
    return jsonResponse(
      await listPandas(env, {
        page: parseIntegerParam(url.searchParams, "page", 1, 1, 1_000_000),
        pageSize: parseIntegerParam(url.searchParams, "page_size", 20, 1, 100),
        q: url.searchParams.get("q"),
        status: parsePandaStatus(url.searchParams.get("status")),
        gender: parsePandaGender(url.searchParams.get("gender")),
        habitatId: url.searchParams.get("habitat_id"),
        featured: parseBooleanParam(url.searchParams, "featured"),
        sort: url.searchParams.get("sort") ?? "created_at_desc"
      })
    );
  }

  const pandaLineageMatch = path.match(/^\/api\/v1\/pandas\/([^/]+)\/lineage$/);
  if (request.method === "GET" && pandaLineageMatch) {
    return jsonResponse(
      await getPandaLineage(env, decodeURIComponent(pandaLineageMatch[1]), {
        ancestorDepth: parseIntegerParam(url.searchParams, "ancestor_depth", 6, 0, 16),
        descendantDepth: parseIntegerParam(url.searchParams, "descendant_depth", 6, 0, 16)
      })
    );
  }

  const pandaDetailMatch = path.match(/^\/api\/v1\/pandas\/([^/]+)$/);
  if (request.method === "GET" && pandaDetailMatch) {
    return jsonResponse(await getPandaDetail(env, decodeURIComponent(pandaDetailMatch[1])));
  }

  if (request.method === "GET" && path === "/api/v1/map/distribution") {
    return jsonResponse(
      await getDistribution(env, {
        bbox: requireBBox(url.searchParams.get("bbox")),
        snapshotDate: url.searchParams.get("snapshot_date"),
        layer: parseDistributionLayer(url.searchParams.get("layer")),
        zoom: parseNullableInteger(url.searchParams.get("zoom"), "zoom", 0, 22)
      })
    );
  }

  if (request.method === "GET" && path === "/api/v1/map/habitats") {
    return jsonResponse(
      await getHabitats(env, parseBBox(url.searchParams.get("bbox"), false), url.searchParams.get("level"))
    );
  }

  if (request.method === "GET" && path === "/api/v1/map/snapshots") {
    return jsonResponse(await listDistributionSnapshots(env, parseIntegerParam(url.searchParams, "limit", 24, 1, 120)));
  }

  if (request.method === "GET" && path === "/api/v1/stats/overview") {
    return jsonResponse(await getOverviewStats(env));
  }

  if (path.startsWith("/api/v1/admin/")) {
    assertAdminRequest(env, request);
    return routeAdminRequest(request, env, path);
  }

  return errorResponse(404, "Not found");
}

async function routeAdminRequest(request: Request, env: Env, path: string): Promise<Response> {
  if (request.method === "GET" && path === "/api/v1/admin/import-sources") {
    return jsonResponse(listImportSources());
  }
  if (request.method === "POST" && path === "/api/v1/admin/import-jobs") {
    return jsonResponse(await createImportJob(env, await readJsonObject(request)), 201);
  }

  const runMatch = path.match(/^\/api\/v1\/admin\/import-jobs\/([^/]+)\/run$/);
  if (request.method === "POST" && runMatch) {
    return jsonResponse(await runImportJob(env, decodeURIComponent(runMatch[1])));
  }

  const getMatch = path.match(/^\/api\/v1\/admin\/import-jobs\/([^/]+)$/);
  if (request.method === "GET" && getMatch) {
    return jsonResponse(await getImportJob(env, decodeURIComponent(getMatch[1])));
  }

  return errorResponse(404, "Not found");
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const payload = await request.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function requireBBox(raw: string | null) {
  const bbox = parseBBox(raw, true);
  if (!bbox) {
    throw new HttpError(422, "bbox is required");
  }
  return bbox;
}

function parseNullableInteger(raw: string | null, name: string, min: number, max: number): number | null {
  if (raw === null || raw === "") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(422, `${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

async function databaseHealth(env: Env): Promise<string> {
  try {
    const row = await env.DB.prepare("select 1 as ok").first<{ ok: number }>();
    return row?.ok === 1 ? "ok" : "error";
  } catch {
    return "error";
  }
}
