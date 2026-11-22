import process from "node:process";
import { pathToFileURL } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CASE_STATES = new Set(["new", "assigned", "closed"]);
const VERIFY_OUTCOMES = new Set(["verified", "rejected"]);
const DECISION_OUTCOMES = new Set(["accepted", "not_accepted", "duplicate", "out_of_scope", "abuse"]);
const ASSERTION_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u;
const DEFAULT_API_BASE = "https://api.zhipanda.com";
const REQUEST_TIMEOUT_MS = 15_000;

export function usage() {
  return [
    "Single-operator review moderation CLI (mutating actions default to dry-run; pass --apply to write):",
    "  node scripts/development/ops-moderation.mjs list [--state new|assigned|closed] [--limit 25] [--offset 0] [--json]",
    "  node scripts/development/ops-moderation.mjs inspect --case-id <UUID> [--json]",
    "  node scripts/development/ops-moderation.mjs claim --case-id <UUID> [--apply]",
    "  node scripts/development/ops-moderation.mjs verify-source --case-id <UUID> --source-id <UUID> --outcome verified|rejected --reason <text> [--canonical-source-id <id>] [--normalized-locator <url>] [--apply]",
    "  node scripts/development/ops-moderation.mjs decide --case-id <UUID> --outcome accepted|not_accepted|duplicate|out_of_scope|abuse --explanation <text> [--assertions k1,k2] [--internal-reason <text>] [--duplicate-of <UUID>] [--apply]",
  ].join("\n");
}

export function normalizeApiBaseUrl(raw) {
  const candidate = (raw ?? DEFAULT_API_BASE).trim();
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`PANDAATLAS_API_BASE_URL must be a valid URL: ${candidate}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`PANDAATLAS_API_BASE_URL must use http or https: ${candidate}`);
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
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function parseModerationArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h"))) {
    return { command: "help" };
  }
  const command = argv[0];
  const flags = new Map();
  const valueFlags = new Set([
    "--state",
    "--limit",
    "--offset",
    "--case-id",
    "--source-id",
    "--outcome",
    "--reason",
    "--canonical-source-id",
    "--normalized-locator",
    "--explanation",
    "--assertions",
    "--internal-reason",
    "--duplicate-of",
  ]);
  const boolFlags = new Set(["--json", "--apply"]);

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (flags.has(token)) throw new Error(`Repeated flag: ${token}`);
    if (boolFlags.has(token)) {
      flags.set(token, true);
    } else if (valueFlags.has(token)) {
      flags.set(token, readValueFlag(argv, index, token));
      index += 1;
    } else {
      throw new Error(`Unknown flag: ${token}`);
    }
  }

  const json = flags.get("--json") === true;
  const apply = flags.get("--apply") === true;

  switch (command) {
    case "list": {
      if (apply) throw new Error("--apply is not supported for list");
      const state = flags.get("--state");
      if (state !== undefined && !CASE_STATES.has(state)) {
        throw new Error("--state must be one of new, assigned, closed");
      }
      const limit = flags.has("--limit") ? parseIntFlag(flags.get("--limit"), "--limit", 1, 100) : 25;
      const offset = flags.has("--offset") ? parseIntFlag(flags.get("--offset"), "--offset", 0, 100_000) : 0;
      return { command, state, limit, offset, json };
    }
    case "inspect": {
      if (apply) throw new Error("--apply is not supported for inspect");
      return {
        command,
        caseId: requireUuid(flags.get("--case-id"), "--case-id"),
        json,
      };
    }
    case "claim": {
      return {
        command,
        caseId: requireUuid(flags.get("--case-id"), "--case-id"),
        apply,
        json,
      };
    }
    case "verify-source": {
      const caseId = requireUuid(flags.get("--case-id"), "--case-id");
      const sourceId = requireUuid(flags.get("--source-id"), "--source-id");
      const outcome = flags.get("--outcome");
      if (!VERIFY_OUTCOMES.has(outcome)) {
        throw new Error("--outcome must be verified or rejected");
      }
      const reason = String(flags.get("--reason") ?? "").trim().replace(/\s+/gu, " ");
      if (reason.length < 3 || reason.length > 2000) {
        throw new Error("--reason must be between 3 and 2000 characters");
      }
      const canonicalSourceId = flags.get("--canonical-source-id");
      const normalizedLocator = flags.get("--normalized-locator");
      return {
        command,
        caseId,
        sourceId,
        outcome,
        reason,
        ...(canonicalSourceId === undefined ? {} : { canonicalSourceId }),
        ...(normalizedLocator === undefined ? {} : { normalizedLocator }),
        apply,
        json,
      };
    }
    case "decide": {
      const caseId = requireUuid(flags.get("--case-id"), "--case-id");
      const outcome = flags.get("--outcome");
      if (!DECISION_OUTCOMES.has(outcome)) {
        throw new Error("--outcome must be accepted, not_accepted, duplicate, out_of_scope, or abuse");
      }
      const userVisibleExplanation = String(flags.get("--explanation") ?? "").trim().replace(/\s+/gu, " ");
      if (userVisibleExplanation.length < 10 || userVisibleExplanation.length > 2000) {
        throw new Error("--explanation must be between 10 and 2000 characters");
      }
      const rawAssertions = String(flags.get("--assertions") ?? "").trim();
      const selectedAssertionKeys = rawAssertions === ""
        ? []
        : [...new Set(rawAssertions.split(",").map((item) => item.trim()).filter(Boolean))];
      for (const key of selectedAssertionKeys) {
        if (!ASSERTION_KEY_PATTERN.test(key)) {
          throw new Error(`Invalid assertion key: ${key}`);
        }
      }
      if (outcome === "accepted" && selectedAssertionKeys.length === 0) {
        throw new Error("--assertions must include at least one key when --outcome is accepted");
      }
      const internalReason = flags.get("--internal-reason")?.trim().replace(/\s+/gu, " ");
      if (internalReason !== undefined && (internalReason.length < 3 || internalReason.length > 4000)) {
        throw new Error("--internal-reason must be between 3 and 4000 characters");
      }
      const duplicateOfReviewCaseId = flags.has("--duplicate-of")
        ? requireUuid(flags.get("--duplicate-of"), "--duplicate-of")
        : undefined;
      return {
        command,
        caseId,
        outcome,
        selectedAssertionKeys,
        userVisibleExplanation,
        ...(internalReason === undefined ? {} : { internalReason }),
        ...(duplicateOfReviewCaseId === undefined ? {} : { duplicateOfReviewCaseId }),
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
    case "list": {
      const query = new URLSearchParams({
        limit: String(parsed.limit),
        offset: String(parsed.offset),
      });
      if (parsed.state !== undefined) query.set("state", parsed.state);
      return {
        mutating: false,
        method: "GET",
        url: `${apiBase}/api/v2/review/cases?${query.toString()}`,
      };
    }
    case "inspect":
      return {
        mutating: false,
        method: "GET",
        url: `${apiBase}/api/v2/review/cases/${parsed.caseId}/surface`,
      };
    case "claim":
      return {
        mutating: true,
        method: "POST",
        url: `${apiBase}/api/v2/review/cases/${parsed.caseId}/claim`,
      };
    case "verify-source":
      return {
        mutating: true,
        method: "POST",
        url: `${apiBase}/api/v2/review/cases/${parsed.caseId}/source-verifications`,
        body: {
          sourceId: parsed.sourceId,
          outcome: parsed.outcome,
          reason: parsed.reason,
          ...(parsed.canonicalSourceId === undefined ? {} : { canonicalSourceId: parsed.canonicalSourceId }),
          ...(parsed.normalizedLocator === undefined ? {} : { normalizedLocator: parsed.normalizedLocator }),
        },
      };
    case "decide":
      return {
        mutating: true,
        method: "POST",
        url: `${apiBase}/api/v2/review/cases/${parsed.caseId}/decision`,
        body: {
          outcome: parsed.outcome,
          selectedAssertionKeys: parsed.selectedAssertionKeys,
          userVisibleExplanation: parsed.userVisibleExplanation,
          ...(parsed.internalReason === undefined ? {} : { internalReason: parsed.internalReason }),
          ...(parsed.duplicateOfReviewCaseId === undefined
            ? {}
            : { duplicateOfReviewCaseId: parsed.duplicateOfReviewCaseId }),
        },
      };
    default:
      throw new Error(`Unsupported command: ${parsed.command}`);
  }
}

function formatProblemDetails(response, payload) {
  const retryAfter = response.headers.get("retry-after");
  const code = typeof payload?.code === "string" ? payload.code : "http_error";
  const detail = typeof payload?.detail === "string" ? payload.detail : response.statusText || "Request failed";
  const retrySuffix = retryAfter ? ` (Retry-After: ${retryAfter}s)` : "";
  return `API ${response.status} [${code}]: ${detail}${retrySuffix}`;
}

export async function executeModerationCommand(
  parsed,
  {
    apiBase = normalizeApiBaseUrl(process.env.PANDAATLAS_API_BASE_URL),
    token = process.env.PANDAATLAS_STAFF_ACCESS_TOKEN,
    fetchFn = fetch,
  } = {},
) {
  if (parsed.command === "help") {
    return { help: usage() };
  }

  const base = normalizeApiBaseUrl(apiBase);
  const spec = buildRequestSpec(parsed, base);

  if (spec.mutating && !parsed.apply) {
    return {
      mode: "dry-run",
      method: spec.method,
      url: spec.url,
      ...(spec.body === undefined ? {} : { body: spec.body }),
      note: "Pass --apply to execute this mutation.",
    };
  }

  const rawToken = typeof token === "string" ? token.trim().replace(/^Bearer\s+/iu, "") : "";
  if (rawToken === "") {
    throw new Error("PANDAATLAS_STAFF_ACCESS_TOKEN is required to call review endpoints");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${rawToken}`,
  };
  if (spec.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchFn(spec.url, {
    method: spec.method,
    headers,
    ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  let parsedBody;
  try {
    parsedBody = text === "" ? undefined : JSON.parse(text);
  } catch {
    parsedBody = undefined;
  }

  if (!response.ok) {
    throw new Error(formatProblemDetails(response, parsedBody));
  }

  return {
    mode: spec.mutating ? "applied" : "read",
    status: response.status,
    data: parsedBody ?? null,
  };
}

function printModerationResult(parsed, result) {
  if (result.help) {
    console.log(result.help);
    return;
  }
  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.mode === "dry-run") {
    console.log(`[dry-run] ${result.method} ${result.url}`);
    if (result.body !== undefined) console.log(JSON.stringify(result.body, null, 2));
    console.log(result.note);
    return;
  }
  if (parsed.command === "list" && Array.isArray(result.data?.items)) {
    const { items, total } = result.data;
    console.log(`Review cases: ${items.length} shown (total ${total ?? items.length})`);
    for (const item of items) {
      const target = item.targetPandaId ?? "-";
      console.log(
        `- ${item.reviewCaseId} [${item.state}] risk=${item.riskLevel} overdue=${String(item.slaOverdue)} target=${target} updated=${item.updatedAt}`,
      );
    }
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  Promise.resolve()
    .then(async () => {
      const parsed = parseModerationArgs(process.argv.slice(2));
      const result = await executeModerationCommand(parsed);
      printModerationResult(parsed, result);
    })
    .catch((error) => {
      console.error(`[ops-moderation] ${error instanceof Error ? error.message : "Operation failed"}`);
      process.exitCode = 1;
    });
}
