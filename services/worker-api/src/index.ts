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
  parsePandaStatus,
} from "./http";
import { parseBBox } from "./geo";
import { releaseHeaders, requireCurrentRelease } from "./repositories/releases";
import {
  getReleaseDistribution,
  getReleaseHabitats,
  getReleaseLineage,
  getReleasePanda,
  getReleaseStats,
  listReleasePandas,
  listReleaseSnapshots,
} from "./repositories/release-reads";

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
      console.error("Unhandled Panda Atlas Worker error", {
        error_type: error instanceof Error ? error.name : typeof error,
      });
      return errorResponse(500, "Internal server error");
    }
  },
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    const db = await databaseHealth(env);
    return jsonResponse({ status: "ok", version: "0.1.0-cloudflare", db });
  }

  if (request.method === "GET" && path === "/api/v1/releases/current") {
    const release = await requireCurrentRelease(env);
    const versionHeaders = releaseHeaders(release);
    return jsonResponse(release, 200, versionHeaders);
  }

  if (request.method === "GET" && path === "/api/v1/releases/current/pandas") {
    const release = await requireCurrentRelease(env);
    const result = await env.DB.prepare(
      `
      select entity_id, public_json
      from current_public_records
      where entity_type = 'pandas'
      order by entity_id
    `,
    ).all<{ entity_id: string; public_json: string }>();
    const records = (result.results ?? []).map((row) => ({
      id: row.entity_id,
      ...(JSON.parse(row.public_json) as Record<string, unknown>),
    }));
    return jsonResponse({ release, records }, 200, releaseHeaders(release));
  }

  if (request.method === "GET" && path === "/api/v1/pandas") {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await listReleasePandas(env, release.dataset_release_version, {
        page: parseIntegerParam(url.searchParams, "page", 1, 1, 1_000_000),
        pageSize: parseIntegerParam(url.searchParams, "page_size", 20, 1, 100),
        q: url.searchParams.get("q"),
        status: parsePandaStatus(url.searchParams.get("status")),
        gender: parsePandaGender(url.searchParams.get("gender")),
        habitatId: url.searchParams.get("habitat_id"),
        featured: parseBooleanParam(url.searchParams, "featured"),
        sort: url.searchParams.get("sort") ?? "created_at_desc",
      }),
      200,
      releaseHeaders(release),
    );
  }

  const pandaLineageMatch = path.match(/^\/api\/v1\/pandas\/([^/]+)\/lineage$/);
  if (request.method === "GET" && pandaLineageMatch) {
    const release = await requireCurrentRelease(env);
    const lineage = await getReleaseLineage(
      env,
      release.dataset_release_version,
      decodeURIComponent(pandaLineageMatch[1]),
      {
        ancestorDepth: parseIntegerParam(
          url.searchParams,
          "ancestor_depth",
          6,
          0,
          16,
        ),
        descendantDepth: parseIntegerParam(
          url.searchParams,
          "descendant_depth",
          6,
          0,
          16,
        ),
      },
    );
    return jsonResponse(lineage, 200, releaseHeaders(release));
  }

  const pandaDetailMatch = path.match(/^\/api\/v1\/pandas\/([^/]+)$/);
  if (request.method === "GET" && pandaDetailMatch) {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await getReleasePanda(
        env,
        release.dataset_release_version,
        decodeURIComponent(pandaDetailMatch[1]),
      ),
      200,
      releaseHeaders(release),
    );
  }

  if (request.method === "GET" && path === "/api/v1/map/distribution") {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await getReleaseDistribution(env, release.dataset_release_version, {
        bbox: requireBBox(url.searchParams.get("bbox")),
        snapshotDate: url.searchParams.get("snapshot_date"),
        layer: parseDistributionLayer(url.searchParams.get("layer")),
        zoom: parseNullableInteger(url.searchParams.get("zoom"), "zoom", 0, 22),
      }),
      200,
      releaseHeaders(release),
    );
  }

  if (request.method === "GET" && path === "/api/v1/map/habitats") {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await getReleaseHabitats(
        env,
        release.dataset_release_version,
        parseBBox(url.searchParams.get("bbox"), false),
        url.searchParams.get("level"),
      ),
      200,
      releaseHeaders(release),
    );
  }

  if (request.method === "GET" && path === "/api/v1/map/snapshots") {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await listReleaseSnapshots(
        env,
        release.dataset_release_version,
        parseIntegerParam(url.searchParams, "limit", 24, 1, 120),
      ),
      200,
      releaseHeaders(release),
    );
  }

  if (request.method === "GET" && path === "/api/v1/stats/overview") {
    const release = await requireCurrentRelease(env);
    return jsonResponse(
      await getReleaseStats(env, release.dataset_release_version),
      200,
      releaseHeaders(release),
    );
  }

  return errorResponse(404, "Not found");
}

function requireBBox(raw: string | null) {
  const bbox = parseBBox(raw, true);
  if (!bbox) {
    throw new HttpError(422, "bbox is required");
  }
  return bbox;
}

function parseNullableInteger(
  raw: string | null,
  name: string,
  min: number,
  max: number,
): number | null {
  if (raw === null || raw === "") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(
      422,
      `${name} must be an integer between ${min} and ${max}`,
    );
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
