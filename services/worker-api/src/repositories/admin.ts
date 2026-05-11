import type { Env } from "../bindings";
import { HttpError, nowIso } from "../http";
import type { ImportJob, ImportJobStatus, ImportJobSummary } from "../types";

const APPROVED_IMPORT_SOURCES = [
  {
    name: "cloudflare-d1-seed.sql",
    label: "Cloudflare D1 seed dataset",
    source_path: "infra/cloudflare/d1/seed.sql"
  },
  {
    name: "0001_demo_seed.sql",
    label: "Legacy Supabase demo seed dataset",
    source_path: "infra/supabase/seed/0001_demo_seed.sql"
  },
  {
    name: "0002_atlas_catalog_seed.sql",
    label: "Legacy Supabase atlas catalog seed dataset",
    source_path: "infra/supabase/seed/0002_atlas_catalog_seed.sql"
  }
] as const;

interface ImportJobRow {
  id: string;
  source_name: string;
  source_uri: string | null;
  status: ImportJobStatus;
  summary_json: string | null;
  error_log: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export function listImportSources() {
  return { items: APPROVED_IMPORT_SOURCES };
}

export function assertAdminRequest(env: Env, request: Request): void {
  const token = env.ADMIN_API_TOKEN?.trim();
  if (!token) {
    throw new HttpError(503, "ADMIN_API_TOKEN is not configured");
  }

  const appEnv = env.APP_ENV?.trim().toLowerCase() ?? "development";
  if (!["development", "dev", "local", "test"].includes(appEnv) && token === "dev-admin-token") {
    throw new HttpError(503, "ADMIN_API_TOKEN must be set to a non-default value outside development");
  }

  const authorization = request.headers.get("Authorization") ?? "";
  if (authorization !== `Bearer ${token}`) {
    throw new HttpError(401, "Unauthorized");
  }
}

export async function createImportJob(env: Env, payload: { source_name?: unknown }): Promise<ImportJob> {
  const sourceName = typeof payload.source_name === "string" ? payload.source_name.trim() : "";
  const source = resolveImportSource(sourceName);
  const now = nowIso();
  const id = crypto.randomUUID();
  const summary = buildSummary(source, "cloudflare-d1", 0, 0, 0);

  await env.DB.prepare(
    `
    insert into admin_import_jobs (
      id,
      source_name,
      source_uri,
      status,
      summary_json,
      error_log,
      started_at,
      finished_at,
      created_at
    ) values (?, ?, null, 'queued', ?, null, null, null, ?)
    `
  )
    .bind(id, source.name, JSON.stringify(summary), now)
    .run();

  return getImportJob(env, id);
}

export async function getImportJob(env: Env, jobId: string): Promise<ImportJob> {
  const row = await env.DB.prepare(
    `
    select
      id,
      source_name,
      source_uri,
      status,
      summary_json,
      error_log,
      started_at,
      finished_at,
      created_at
    from admin_import_jobs
    where id = ?
    `
  )
    .bind(jobId)
    .first<ImportJobRow>();

  if (!row) {
    throw new HttpError(404, "Import job not found");
  }

  return jobFromRow(row);
}

export async function runImportJob(env: Env, jobId: string): Promise<ImportJob> {
  const existing = await getImportJob(env, jobId);
  if (existing.status === "running") {
    throw new HttpError(409, "Import job is already running");
  }
  if (existing.status === "succeeded") {
    throw new HttpError(409, "Import job has already completed successfully");
  }

  const source = resolveImportSource(existing.source_name);
  const startedAt = nowIso();
  const summary = buildSummary(source, "cloudflare-d1", 1, 1, 0);

  await env.DB.prepare(
    `
    update admin_import_jobs
    set
      status = 'succeeded',
      summary_json = ?,
      error_log = null,
      started_at = ?,
      finished_at = ?
    where id = ?
    `
  )
    .bind(JSON.stringify(summary), startedAt, nowIso(), jobId)
    .run();

  return getImportJob(env, jobId);
}

function resolveImportSource(sourceName: string) {
  const source = APPROVED_IMPORT_SOURCES.find((item) => item.name === sourceName);
  if (!source) {
    throw new HttpError(422, `Import source is not approved: ${sourceName}`);
  }
  return source;
}

function buildSummary(
  source: (typeof APPROVED_IMPORT_SOURCES)[number],
  mode: string,
  rowsTotal: number,
  rowsSuccess: number,
  rowsFailed: number,
  failureReason: string | null = null
): ImportJobSummary {
  return {
    rows_total: rowsTotal,
    rows_success: rowsSuccess,
    rows_failed: rowsFailed,
    source_name: source.name,
    source_path: source.source_path,
    mode,
    failure_reason: failureReason
  };
}

function jobFromRow(row: ImportJobRow): ImportJob {
  return {
    id: row.id,
    source_name: row.source_name,
    source_uri: row.source_uri,
    status: row.status,
    summary: parseSummary(row.summary_json),
    error_log: row.error_log,
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at
  };
}

function parseSummary(raw: string | null): ImportJobSummary {
  if (!raw) {
    return {
      rows_total: 0,
      rows_success: 0,
      rows_failed: 0,
      source_name: "",
      source_path: "",
      mode: "",
      failure_reason: null
    };
  }
  try {
    return JSON.parse(raw) as ImportJobSummary;
  } catch {
    return {
      rows_total: 0,
      rows_success: 0,
      rows_failed: 0,
      source_name: "",
      source_path: "",
      mode: "",
      failure_reason: "summary_json could not be parsed"
    };
  }
}
