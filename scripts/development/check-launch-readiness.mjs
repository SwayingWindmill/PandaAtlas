import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { DEFAULT_PHOTO_KEYS_PATH, validatePublishedPhotoKeysText } from "../release/published-photo-keys.mjs";

const DEFAULT_API_BASE = "https://api.zhipanda.com";
const DEFAULT_WEB_BASE = "https://www.zhipanda.com";
const REQUEST_TIMEOUT_MS = 20_000;
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const LEGAL_DOCUMENTS_PATH = path.join(REPO_ROOT, "apps/web/features/legal/documents.ts");
const LOCAL_LEARNING_PATH = path.join(REPO_ROOT, "data/curation/learning/learning.json");

const LEGAL_DRAFT_MARKERS = [
  "[运营方名称]",
  "[Operator name]",
  "[生效日期]",
  "[Effective date]",
  "这是草稿，尚未生效",
  "This is a draft and is not in effect",
];

export function usage() {
  return [
    "Read-only launch readiness check:",
    "  node scripts/development/check-launch-readiness.mjs [--api-base <url>] [--web-base <url>] [--offline] [--strict] [--json]",
  ].join("\n");
}

function validateHttpBase(raw, name) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must use http or https: ${raw}`);
  }
  return parsed.toString().replace(/\/+$/u, "");
}

export function parseLaunchReadinessArgs(argv) {
  const options = {
    help: false,
    apiBase: DEFAULT_API_BASE,
    webBase: DEFAULT_WEB_BASE,
    offline: false,
    strict: false,
    json: false,
  };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (seen.has(arg)) throw new Error(`Repeated flag: ${arg}`);
    seen.add(arg);
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--offline") {
      options.offline = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--api-base" || arg === "--web-base") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a URL`);
      index += 1;
      if (arg === "--api-base") options.apiBase = validateHttpBase(value, "--api-base");
      else options.webBase = validateHttpBase(value, "--web-base");
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return options;
}

function checkItem(id, status, summary) {
  return { id, status, summary };
}

function formatFetchError(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause instanceof Error) {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : cause.message;
    return `${error.message} (${code})`;
  }
  return error.message;
}

async function defaultFetch(url) {
  return fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function fetchWithRetry(fetchFn, url, { maxRetries = 2, retryDelayMs = 400 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchFn(url);
      if (response.status < 500 || attempt === maxRetries) return response;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
    }
    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

async function fetchJsonEndpoint(fetchFn, url, retryOptions) {
  const response = await fetchWithRetry(fetchFn, url, retryOptions);
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  const body = await response.json();
  return { ok: true, status: response.status, body };
}

export async function runLaunchReadinessCheck(
  options = {},
  {
    readText = (filePath) => readFile(filePath, "utf8"),
    fetchFn = defaultFetch,
    maxRetries = 2,
    retryDelayMs = 400,
    legalPath = LEGAL_DOCUMENTS_PATH,
    photoKeysPath = DEFAULT_PHOTO_KEYS_PATH,
    learningPath = LOCAL_LEARNING_PATH,
  } = {},
) {
  const retryOptions = { maxRetries, retryDelayMs };
  const resolved = {
    apiBase: validateHttpBase(options.apiBase ?? DEFAULT_API_BASE, "--api-base"),
    webBase: validateHttpBase(options.webBase ?? DEFAULT_WEB_BASE, "--web-base"),
    offline: options.offline === true,
    strict: options.strict === true,
  };
  const checks = [];

  // 1. Local legal draft status
  try {
    const legalText = await readText(legalPath);
    const hits = LEGAL_DRAFT_MARKERS.filter((marker) => legalText.includes(marker));
    checks.push(
      hits.length > 0
        ? checkItem("local.legal-documents", "WARN", `Legal pages still contain draft markers: ${hits.join(", ")}`)
        : checkItem("local.legal-documents", "PASS", "Legal documents have no remaining draft markers"),
    );
  } catch (error) {
    checks.push(checkItem("local.legal-documents", "FAIL", error instanceof Error ? error.message : String(error)));
  }

  // 2. Canonical published photo keys allowlist
  try {
    const keys = validatePublishedPhotoKeysText(await readText(photoKeysPath));
    checks.push(checkItem("local.published-photo-keys", "PASS", `Validated ${keys.length} published photo keys`));
  } catch (error) {
    checks.push(checkItem("local.published-photo-keys", "FAIL", error instanceof Error ? error.message : String(error)));
  }

  // 3. Local learning catalog
  let localLearningVersion;
  try {
    const learning = JSON.parse(await readText(learningPath));
    if (typeof learning?.version !== "string" || learning.version.trim() === "") {
      throw new Error("data/curation/learning/learning.json is missing version");
    }
    localLearningVersion = learning.version;
    const articles = Array.isArray(learning.articles) ? learning.articles.length : 0;
    const terms = Array.isArray(learning.terms) ? learning.terms.length : 0;
    checks.push(
      checkItem("local.learning-catalog", "PASS", `Local learning version ${localLearningVersion} (${articles} articles, ${terms} terms)`),
    );
  } catch (error) {
    checks.push(checkItem("local.learning-catalog", "FAIL", error instanceof Error ? error.message : String(error)));
  }

  if (resolved.offline) {
    checks.push(checkItem("online.probes", "SKIP", "Skipped online checks (--offline)"));
  } else {
    // 4a. API /ready and /health/async
    for (const [id, route] of [
      ["online.api-ready", "/ready"],
      ["online.api-async", "/health/async"],
    ]) {
      try {
        const res = await fetchWithRetry(fetchFn, `${resolved.apiBase}${route}`, retryOptions);
        await res.body?.cancel().catch(() => undefined);
        checks.push(
          res.ok
            ? checkItem(id, "PASS", `${route} responded HTTP ${res.status}`)
            : checkItem(id, "FAIL", `${route} responded HTTP ${res.status}`),
        );
      } catch (error) {
        checks.push(checkItem(id, "FAIL", `${route} request failed: ${formatFetchError(error)}`));
      }
    }

    // 4b. API /api/v2/learning version parity
    try {
      const res = await fetchJsonEndpoint(fetchFn, `${resolved.apiBase}/api/v2/learning`, retryOptions);
      if (!res.ok) {
        checks.push(checkItem("online.learning-version", "FAIL", `/api/v2/learning responded HTTP ${res.status}`));
      } else {
        const liveVersion = typeof res.body?.version === "string" ? res.body.version.trim() : "";
        if (liveVersion === "") {
          checks.push(checkItem("online.learning-version", "FAIL", "/api/v2/learning response is missing version"));
        } else if (localLearningVersion === undefined) {
          checks.push(
            checkItem("online.learning-version", "WARN", `Live learning is ${liveVersion} (local version unavailable)`),
          );
        } else if (liveVersion !== localLearningVersion) {
          checks.push(
            checkItem("online.learning-version", "WARN", `Live learning ${liveVersion} lags local ${localLearningVersion}`),
          );
        } else {
          checks.push(checkItem("online.learning-version", "PASS", `Live learning matches ${liveVersion}`));
        }
      }
    } catch (error) {
      checks.push(
        checkItem("online.learning-version", "FAIL", `/api/v2/learning failed: ${formatFetchError(error)}`),
      );
    }

    // 4c. Empty shell catalog checks (/api/v2/venue-news and /api/v2/overseas-status)
    for (const [id, route] of [
      ["online.venue-news", "/api/v2/venue-news"],
      ["online.overseas-status", "/api/v2/overseas-status"],
    ]) {
      try {
        const res = await fetchJsonEndpoint(fetchFn, `${resolved.apiBase}${route}`, retryOptions);
        if (!res.ok) {
          checks.push(checkItem(id, "FAIL", `${route} responded HTTP ${res.status}`));
        } else {
          const count = Array.isArray(res.body?.items) ? res.body.items.length : 0;
          checks.push(
            count > 0
              ? checkItem(id, "PASS", `${route} serves ${count} items`)
              : checkItem(id, "WARN", `${route} serves 0 items`),
          );
        }
      } catch (error) {
        checks.push(checkItem(id, "FAIL", `${route} failed: ${formatFetchError(error)}`));
      }
    }

    // 4d. Public Web pages + live legal draft check
    for (const [id, route, checkLegalDraft] of [
      ["online.web-home", "/zh", false],
      ["online.web-terms", "/zh/terms", true],
      ["online.web-privacy", "/zh/privacy", true],
    ]) {
      try {
        const res = await fetchWithRetry(fetchFn, `${resolved.webBase}${route}`, retryOptions);
        if (!res.ok) {
          await res.body?.cancel().catch(() => undefined);
          checks.push(checkItem(id, "FAIL", `${route} responded HTTP ${res.status}`));
          continue;
        }
        if (!checkLegalDraft) {
          await res.body?.cancel().catch(() => undefined);
          checks.push(checkItem(id, "PASS", `${route} responded HTTP ${res.status}`));
          continue;
        }
        const html = await res.text();
        const draftHit = LEGAL_DRAFT_MARKERS.some((marker) => html.includes(marker));
        checks.push(
          draftHit
            ? checkItem(id, "WARN", `${route} responded HTTP ${res.status} (draft markers still live)`)
            : checkItem(id, "PASS", `${route} responded HTTP ${res.status}`),
        );
      } catch (error) {
        checks.push(checkItem(id, "FAIL", `${route} failed: ${formatFetchError(error)}`));
      }
    }
  }

  const counts = {
    pass: checks.filter((c) => c.status === "PASS").length,
    warn: checks.filter((c) => c.status === "WARN").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    skip: checks.filter((c) => c.status === "SKIP").length,
  };
  const ok = counts.fail === 0 && (!resolved.strict || counts.warn === 0);
  return { ok, counts, checks, apiBase: resolved.apiBase, webBase: resolved.webBase, offline: resolved.offline };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  Promise.resolve()
    .then(async () => {
      const options = parseLaunchReadinessArgs(process.argv.slice(2));
      if (options.help) {
        console.log(usage());
        return;
      }
      const report = await runLaunchReadinessCheck(options);
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(`Launch readiness (api=${report.apiBase}, web=${report.webBase}, offline=${report.offline}):`);
        for (const item of report.checks) {
          console.log(`[${item.status}] ${item.id}: ${item.summary}`);
        }
        console.log(
          `Summary: ${report.counts.pass} PASS, ${report.counts.warn} WARN, ${report.counts.fail} FAIL, ${report.counts.skip} SKIP`,
        );
      }
      if (!report.ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[launch-readiness] ${error instanceof Error ? error.message : "Check failed"}`);
      process.exitCode = 1;
    });
}
