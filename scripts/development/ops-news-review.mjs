import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const INTEGER_PATTERN = /^\d+$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ITEM_STATUSES = new Set(["pending_review", "published", "rejected", "hidden"]);
const ITEM_DECISIONS = new Set(["publish", "reject", "hide"]);
const FACT_STATES = new Set(["pending_review", "approved", "rejected"]);
const FACT_DECISIONS = new Set(["approved", "rejected"]);
const DEFAULT_API_BASE = "https://api.zhipanda.com";
const REQUEST_TIMEOUT_MS = 15_000;

const ALLOWED_FLAGS_BY_COMMAND = {
  "list-items": new Set(["--status", "--limit", "--offset", "--json"]),
  "decide-item": new Set(["--item-id", "--decision", "--note", "--pandas", "--institution", "--apply", "--json"]),
  "list-facts": new Set(["--state", "--limit", "--offset", "--json"]),
  "decide-fact": new Set(["--candidate-id", "--decision", "--note", "--panda", "--institution", "--apply", "--json"]),
};

export function usage() {
  return [
    "Single-operator live news & fact-candidate moderation CLI (mutating actions default to dry-run; pass --apply):",
    "  node scripts/development/ops-news-review.mjs list-items [--status pending_review|published|rejected|hidden] [--limit 25] [--offset 0] [--json]",
    "  node scripts/development/ops-news-review.mjs decide-item --item-id <UUID> --decision publish|reject|hide [--note <text>] [--pandas slug1,slug2] [--institution slug] [--apply]",
    "  node scripts/development/ops-news-review.mjs list-facts [--state pending_review|approved|rejected] [--limit 25] [--offset 0] [--json]",
    "  node scripts/development/ops-news-review.mjs decide-fact --candidate-id <UUID> --decision approved|rejected [--note <text>] [--panda slug] [--institution slug] [--apply]",
  ].join("\n");
}

export function normalizeApiBaseUrl(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const candidate = trimmed === "" ? DEFAULT_API_BASE : trimmed;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`PANDAATLAS_API_BASE_URL must be a valid URL: ${candidate}`);
  }
  const isLocalHttp =
    parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`PANDAATLAS_API_BASE_URL must use https (http only allowed for localhost/127.0.0.1): ${candidate}`);
  }
  return parsed.toString().replace(/\/+$/u, "");
}

function readValueFlag(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function requireUuid(value, name) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid UUID`);
  }
  return value;
}

function parseIntFlag(raw, name, min, max) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!INTEGER_PATTERN.test(trimmed)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function requireSlug(raw, name) {
  const trimmed = String(raw).trim();
  if (!SLUG_PATTERN.test(trimmed)) {
    throw new Error(`${name} must be a lowercase slug`);
  }
  return trimmed;
}

export function parseNewsReviewArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h"))) {
    return { command: "help" };
  }
  const command = argv[0];
  const allowedFlags = ALLOWED_FLAGS_BY_COMMAND[command];
  if (allowedFlags === undefined) {
    throw new Error(`Unknown subcommand: ${command}`);
  }

  const flags = new Map();
  const boolFlags = new Set(["--json", "--apply"]);
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!allowedFlags.has(token)) throw new Error(`Flag ${token} is not supported for ${command}`);
    if (flags.has(token)) throw new Error(`Repeated flag: ${token}`);
    if (boolFlags.has(token)) {
      flags.set(token, true);
    } else {
      flags.set(token, readValueFlag(argv, index, token));
      index += 1;
    }
  }

  const json = flags.get("--json") === true;
  const apply = flags.get("--apply") === true;

  switch (command) {
    case "list-items": {
      const status = flags.get("--status");
      if (status !== undefined && !ITEM_STATUSES.has(status)) {
        throw new Error("--status must be one of pending_review, published, rejected, hidden");
      }
      const limit = flags.has("--limit") ? parseIntFlag(flags.get("--limit"), "--limit", 1, 100) : 25;
      const offset = flags.has("--offset") ? parseIntFlag(flags.get("--offset"), "--offset", 0, 100_000) : 0;
      return { command, status, limit, offset, json };
    }
    case "decide-item": {
      const itemId = requireUuid(flags.get("--item-id"), "--item-id");
      const decision = flags.get("--decision");
      if (!ITEM_DECISIONS.has(decision)) {
        throw new Error("--decision must be one of publish, reject, hide");
      }
      const note = flags.has("--note") ? String(flags.get("--note")).trim().slice(0, 500) : undefined;
      const pandaSlugs = flags.has("--pandas")
        ? String(flags.get("--pandas"))
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => requireSlug(entry, "--pandas"))
        : undefined;
      const institutionSlug = flags.has("--institution")
        ? requireSlug(flags.get("--institution"), "--institution")
        : undefined;
      return { command, itemId, decision, note, pandaSlugs, institutionSlug, apply, json };
    }
    case "list-facts": {
      const reviewState = flags.get("--state");
      if (reviewState !== undefined && !FACT_STATES.has(reviewState)) {
        throw new Error("--state must be one of pending_review, approved, rejected");
      }
      const limit = flags.has("--limit") ? parseIntFlag(flags.get("--limit"), "--limit", 1, 100) : 25;
      const offset = flags.has("--offset") ? parseIntFlag(flags.get("--offset"), "--offset", 0, 100_000) : 0;
      return { command, reviewState, limit, offset, json };
    }
    case "decide-fact": {
      const candidateId = requireUuid(flags.get("--candidate-id"), "--candidate-id");
      const decision = flags.get("--decision");
      if (!FACT_DECISIONS.has(decision)) {
        throw new Error("--decision must be approved or rejected");
      }
      const note = flags.has("--note") ? String(flags.get("--note")).trim().slice(0, 500) : undefined;
      const targetPandaSlug = flags.has("--panda") ? requireSlug(flags.get("--panda"), "--panda") : undefined;
      const targetInstitutionSlug = flags.has("--institution")
        ? requireSlug(flags.get("--institution"), "--institution")
        : undefined;
      return {
        command,
        candidateId,
        decision,
        note,
        targetPandaSlug,
        targetInstitutionSlug,
        apply,
        json,
      };
    }
    default:
      throw new Error(`Unknown subcommand: ${command}`);
  }
}

function buildRequestSpec(parsed, apiBase) {
  switch (parsed.command) {
    case "list-items": {
      const query = new URLSearchParams({ limit: String(parsed.limit), offset: String(parsed.offset) });
      if (parsed.status !== undefined) query.set("status", parsed.status);
      return { mutating: false, method: "GET", url: `${apiBase}/api/v2/news/review/items?${query.toString()}` };
    }
    case "decide-item":
      return {
        mutating: true,
        method: "POST",
        url: `${apiBase}/api/v2/news/review/items/${parsed.itemId}/decision`,
        body: {
          decision: parsed.decision,
          ...(parsed.note ? { reviewNote: parsed.note } : {}),
          ...(parsed.pandaSlugs ? { pandaSlugs: parsed.pandaSlugs } : {}),
          ...(parsed.institutionSlug ? { institutionSlug: parsed.institutionSlug } : {}),
        },
      };
    case "list-facts": {
      const query = new URLSearchParams({ limit: String(parsed.limit), offset: String(parsed.offset) });
      if (parsed.reviewState !== undefined) query.set("reviewState", parsed.reviewState);
      return {
        mutating: false,
        method: "GET",
        url: `${apiBase}/api/v2/news/review/fact-candidates?${query.toString()}`,
      };
    }
    case "decide-fact":
      return {
        mutating: true,
        method: "POST",
        url: `${apiBase}/api/v2/news/review/fact-candidates/${parsed.candidateId}/decision`,
        body: {
          decision: parsed.decision,
          ...(parsed.note ? { reviewNote: parsed.note } : {}),
          ...(parsed.targetPandaSlug ? { targetPandaSlug: parsed.targetPandaSlug } : {}),
          ...(parsed.targetInstitutionSlug ? { targetInstitutionSlug: parsed.targetInstitutionSlug } : {}),
        },
      };
    default:
      throw new Error(`Unsupported command: ${parsed.command}`);
  }
}

function formatProblemDetails(response, payload) {
  const code = typeof payload?.code === "string" ? payload.code : "http_error";
  const detail = typeof payload?.detail === "string" ? payload.detail : response.statusText || "Request failed";
  return `API ${response.status} [${code}]: ${detail}`;
}

export async function executeNewsReviewCommand(
  parsed,
  {
    apiBase,
    token = process.env.PANDAATLAS_STAFF_ACCESS_TOKEN,
    fetchFn = fetch,
  } = {},
) {
  if (parsed.command === "help") {
    return { help: usage() };
  }
  const base = normalizeApiBaseUrl(apiBase ?? process.env.PANDAATLAS_API_BASE_URL);
  const spec = buildRequestSpec(parsed, base);

  if (spec.mutating && !parsed.apply) {
    return {
      mode: "dry-run",
      method: spec.method,
      url: spec.url,
      body: spec.body,
      note: "Pass --apply to execute this mutation.",
    };
  }

  const rawToken = typeof token === "string" ? token.trim().replace(/^Bearer\s+/iu, "") : "";
  if (rawToken === "") {
    throw new Error("PANDAATLAS_STAFF_ACCESS_TOKEN is required to call news review endpoints");
  }

  const headers = { Accept: "application/json", Authorization: `Bearer ${rawToken}` };
  if (spec.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetchFn(spec.url, {
    method: spec.method,
    headers,
    ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text === "" ? undefined : JSON.parse(text);
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    throw new Error(formatProblemDetails(response, payload));
  }
  return { mode: spec.mutating ? "applied" : "read", status: response.status, data: payload ?? null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  Promise.resolve()
    .then(async () => {
      const parsed = parseNewsReviewArgs(process.argv.slice(2));
      const result = await executeNewsReviewCommand(parsed);
      console.log(result.help ?? JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(`[ops-news-review] ${error instanceof Error ? error.message : "Operation failed"}`);
      process.exitCode = 1;
    });
}
