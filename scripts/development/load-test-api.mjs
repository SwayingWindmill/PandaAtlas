import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";
const DEFAULT_CONCURRENCY = [1, 5, 10, 20];
const DEFAULT_REQUESTS = 100;
const DEFAULT_WARMUP = 5;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_PANDA_SLUG = "bao-li";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INTEGER_PATTERN = /^\d+$/u;
const ALLOWED_FORMATS = new Set(["text", "markdown", "json"]);

export const SCENARIOS = Object.freeze({
  "public-cached": (pandaSlug = DEFAULT_PANDA_SLUG) => [
    { route: "/api/v2/release", group: "public-cached", weight: 1 },
    { route: "/api/v2/pandas?limit=24", group: "public-cached", weight: 2 },
    { route: `/api/v2/pandas/${pandaSlug}`, group: "public-cached", weight: 2 },
    { route: "/api/v2/places", group: "public-cached", weight: 1 },
    { route: "/api/v2/institutions", group: "public-cached", weight: 1 },
    { route: "/api/v2/stats", group: "public-cached", weight: 1 },
  ],
  "public-db-uncached": () => [
    { route: "/ready", group: "public-db-uncached", weight: 1 },
    { route: "/api/v2/learning", group: "public-db-uncached", weight: 2 },
    { route: "/api/v2/overseas-status", group: "public-db-uncached", weight: 1 },
    { route: "/api/v2/venue-news", group: "public-db-uncached", weight: 1 },
    { route: "/api/v2/comparisons", group: "public-db-uncached", weight: 1 },
    { route: "/api/v2/popular-pandas", group: "public-db-uncached", weight: 1 },
    { route: "/api/v2/updates", group: "public-db-uncached", weight: 1 },
  ],
  "authenticated-read": () => [
    { route: "/api/v2/me", group: "authenticated-read", weight: 1 },
    { route: "/api/v2/me/profile", group: "authenticated-read", weight: 1 },
    { route: "/api/v2/me/favorites", group: "authenticated-read", weight: 1 },
    { route: "/api/v2/me/followed-venues", group: "authenticated-read", weight: 1 },
    { route: "/api/v2/me/daily-checkins", group: "authenticated-read", weight: 1 },
    { route: "/api/v2/me/panda-book", group: "authenticated-read", weight: 1 },
  ],
  "mixed-launch": (pandaSlug = DEFAULT_PANDA_SLUG, hasToken = false) => {
    const cached = expandEntries(SCENARIOS["public-cached"](pandaSlug), "public-cached");
    const uncached = expandEntries(SCENARIOS["public-db-uncached"](), "public-db-uncached");
    if (!hasToken) {
      return smoothInterleave(
        [
          { weight: 3, items: cached },
          { weight: 1, items: uncached },
        ],
        32,
      );
    }
    const authed = expandEntries(SCENARIOS["authenticated-read"](), "authenticated-read");
    return smoothInterleave(
      [
        { weight: 7, items: cached },
        { weight: 2, items: uncached },
        { weight: 1, items: authed },
      ],
      240,
    );
  },
});

function expandEntries(entries, group) {
  const expanded = [];
  for (const entry of entries) {
    const count = Math.max(1, entry.weight ?? 1);
    for (let i = 0; i < count; i += 1) {
      expanded.push({ route: entry.route, group, weight: 1 });
    }
  }
  return expanded;
}

function smoothInterleave(groups, length) {
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  const state = groups.map((group) => ({ ...group, currentWeight: 0, cursor: 0 }));
  const schedule = [];
  for (let i = 0; i < length; i += 1) {
    let best = state[0];
    for (const candidate of state) {
      candidate.currentWeight += candidate.weight;
      if (candidate.currentWeight > best.currentWeight) {
        best = candidate;
      }
    }
    best.currentWeight -= totalWeight;
    const item = best.items[best.cursor % best.items.length];
    best.cursor += 1;
    schedule.push(item);
  }
  return schedule;
}

export function usage() {
  return [
    "API capacity & Hyperdrive concurrency load-test harness (loopback only unless explicitly confirmed):",
    "  node scripts/development/load-test-api.mjs [--base-url http://127.0.0.1:3001] [--scenario mixed-launch]",
    "    [--concurrency 1,5,10,20] [--requests 100 | --duration-sec 10] [--warmup 5] [--timeout-ms 10000]",
    "    [--panda-slug bao-li] [--bearer-token <jwt>] [--format text|markdown|json]",
    "    [--allow-remote --confirm-host <exact-hostname>]",
  ].join("\n");
}

function readValueFlag(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseIntInRange(raw, name, min, max) {
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

function parseConcurrencyList(raw) {
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("--concurrency must list at least one positive integer");
  }
  const values = [];
  const seen = new Set();
  for (const part of parts) {
    const num = parseIntInRange(part, "--concurrency", 1, 200);
    if (!seen.has(num)) {
      seen.add(num);
      values.push(num);
    }
  }
  return values;
}

/**
 * Normalizes and validates target URL safety. Any non-loopback target requires both `--allow-remote`
 * and an exact hostname match via `--confirm-host` to prevent accidental blind production load tests.
 */
export function assertTargetAllowed(rawUrl, { allowRemote = false, confirmHost = "" } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid --base-url: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`--base-url must use http or https: ${rawUrl}`);
  }
  const normalizedBase = parsed.toString().replace(/\/+$/u, "");
  const host = parsed.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    if (!allowRemote || confirmHost.trim().toLowerCase() !== host) {
      throw new Error(
        `Refusing non-loopback load test target "${host}". Pass both --allow-remote and --confirm-host ${host} only against an authorized target.`,
      );
    }
  }
  return { baseUrl: normalizedBase, hostname: host, isLoopback: LOOPBACK_HOSTS.has(host) };
}

export function parseArgs(argv, env = process.env) {
  const options = {
    help: false,
    baseUrl: DEFAULT_BASE_URL,
    scenario: "mixed-launch",
    concurrency: [...DEFAULT_CONCURRENCY],
    requests: undefined,
    durationSec: undefined,
    warmup: DEFAULT_WARMUP,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    bearerToken: typeof env.LOAD_TEST_BEARER_TOKEN === "string" ? env.LOAD_TEST_BEARER_TOKEN.trim() : "",
    pandaSlug: DEFAULT_PANDA_SLUG,
    format: "text",
    allowRemote: false,
    confirmHost: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--allow-remote") {
      options.allowRemote = true;
    } else if (arg === "--base-url") {
      options.baseUrl = readValueFlag(argv, i, arg);
      i += 1;
    } else if (arg === "--confirm-host") {
      options.confirmHost = readValueFlag(argv, i, arg);
      i += 1;
    } else if (arg === "--scenario") {
      options.scenario = readValueFlag(argv, i, arg).trim();
      i += 1;
    } else if (arg === "--concurrency") {
      options.concurrency = parseConcurrencyList(readValueFlag(argv, i, arg));
      i += 1;
    } else if (arg === "--requests") {
      options.requests = parseIntInRange(readValueFlag(argv, i, arg), "--requests", 1, 100_000);
      i += 1;
    } else if (arg === "--duration-sec") {
      options.durationSec = parseIntInRange(readValueFlag(argv, i, arg), "--duration-sec", 1, 300);
      i += 1;
    } else if (arg === "--warmup") {
      options.warmup = parseIntInRange(readValueFlag(argv, i, arg), "--warmup", 0, 100);
      i += 1;
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parseIntInRange(readValueFlag(argv, i, arg), "--timeout-ms", 100, 60_000);
      i += 1;
    } else if (arg === "--bearer-token") {
      options.bearerToken = readValueFlag(argv, i, arg).trim();
      i += 1;
    } else if (arg === "--panda-slug") {
      options.pandaSlug = readValueFlag(argv, i, arg).trim();
      i += 1;
    } else if (arg === "--format") {
      options.format = readValueFlag(argv, i, arg).trim().toLowerCase();
      i += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (options.help) return options;

  if (!Object.hasOwn(SCENARIOS, options.scenario)) {
    throw new Error(`--scenario must be one of: ${Object.keys(SCENARIOS).join(", ")}`);
  }
  if (!ALLOWED_FORMATS.has(options.format)) {
    throw new Error(`--format must be one of: ${[...ALLOWED_FORMATS].join(", ")}`);
  }
  if (!SLUG_PATTERN.test(options.pandaSlug)) {
    throw new Error(`--panda-slug is malformed: ${options.pandaSlug}`);
  }
  if (options.requests !== undefined && options.durationSec !== undefined) {
    throw new Error("--requests and --duration-sec are mutually exclusive");
  }
  if (options.requests === undefined && options.durationSec === undefined) {
    options.requests = DEFAULT_REQUESTS;
  }
  if (options.scenario === "authenticated-read" && options.bearerToken === "") {
    throw new Error("authenticated-read requires --bearer-token or LOAD_TEST_BEARER_TOKEN");
  }

  const target = assertTargetAllowed(options.baseUrl, {
    allowRemote: options.allowRemote,
    confirmHost: options.confirmHost,
  });
  options.baseUrl = target.baseUrl;
  options.hostname = target.hostname;
  options.isLoopback = target.isLoopback;
  return options;
}

export function buildSchedule(scenarioName, { pandaSlug = DEFAULT_PANDA_SLUG, hasToken = false } = {}) {
  const entries = SCENARIOS[scenarioName](pandaSlug, hasToken);
  const schedule = [];
  for (const entry of entries) {
    const count = Math.max(1, entry.weight ?? 1);
    for (let i = 0; i < count; i += 1) {
      schedule.push(entry.route);
    }
  }
  return schedule;
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

/** Computes percentile latency statistics (ms) via nearest-rank on a sorted copy. */
export function computePercentiles(samples) {
  if (samples.length === 0) {
    return { count: 0, minMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0, avgMs: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  return {
    count: sorted.length,
    minMs: roundMs(sorted[0]),
    p50Ms: roundMs(rank(50)),
    p95Ms: roundMs(rank(95)),
    p99Ms: roundMs(rank(99)),
    maxMs: roundMs(sorted[sorted.length - 1]),
    avgMs: roundMs(sum / sorted.length),
  };
}

function createCounters() {
  return {
    requests: 0,
    ok2xx: 0,
    rateLimited429: 0,
    client4xx: 0,
    server5xx: 0,
    otherStatus: 0,
    networkErrors: 0,
    latencies: [],
  };
}

function recordResult(bucket, item) {
  bucket.requests += 1;
  bucket.latencies.push(item.latencyMs);
  if (item.error) {
    bucket.networkErrors += 1;
  } else if (item.status >= 200 && item.status < 300) {
    bucket.ok2xx += 1;
  } else if (item.status === 429) {
    bucket.rateLimited429 += 1;
  } else if (item.status >= 400 && item.status < 500) {
    bucket.client4xx += 1;
  } else if (item.status >= 500 && item.status < 600) {
    bucket.server5xx += 1;
  } else {
    bucket.otherStatus += 1;
  }
}

function finalizeBucket(bucket, durationMs) {
  const stats = computePercentiles(bucket.latencies);
  const seconds = durationMs > 0 ? durationMs / 1000 : 0;
  return {
    requests: bucket.requests,
    ok2xx: bucket.ok2xx,
    rateLimited429: bucket.rateLimited429,
    client4xx: bucket.client4xx,
    server5xx: bucket.server5xx,
    otherStatus: bucket.otherStatus,
    networkErrors: bucket.networkErrors,
    rps: seconds > 0 ? roundMs(bucket.requests / seconds) : 0,
    ...stats,
  };
}

export function summarizeLevel({ concurrency, durationMs, results }) {
  const total = createCounters();
  const byRoute = new Map();
  for (const item of results) {
    recordResult(total, item);
    let routeBucket = byRoute.get(item.route);
    if (!routeBucket) {
      routeBucket = createCounters();
      byRoute.set(item.route, routeBucket);
    }
    recordResult(routeBucket, item);
  }
  const routes = [...byRoute.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([route, bucket]) => ({ route, ...finalizeBucket(bucket, durationMs) }));

  return {
    concurrency,
    durationMs: roundMs(durationMs),
    ...finalizeBucket(total, durationMs),
    routes,
  };
}

async function issueOne({ baseUrl, route, timeoutMs, bearerToken, fetchFn }) {
  const headers = { accept: "application/json" };
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }
  const started = performance.now();
  try {
    const response = await fetchFn(`${baseUrl}${route}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Consume the body so Keep-Alive sockets return cleanly to the pool.
    await response.arrayBuffer();
    return {
      route,
      status: response.status,
      error: false,
      latencyMs: performance.now() - started,
    };
  } catch (error) {
    return {
      route,
      status: 0,
      error: true,
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs: performance.now() - started,
    };
  }
}

export async function runLoadLevel({
  baseUrl,
  schedule,
  concurrency,
  requests,
  durationSec,
  warmup = 0,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  bearerToken = "",
  fetchFn = fetch,
}) {
  for (let i = 0; i < warmup; i += 1) {
    await issueOne({
      baseUrl,
      route: schedule[i % schedule.length],
      timeoutMs,
      bearerToken,
      fetchFn,
    });
  }

  const results = [];
  let nextIndex = 0;
  const started = performance.now();
  const deadline = durationSec !== undefined ? started + durationSec * 1000 : undefined;

  async function worker() {
    while (true) {
      if (deadline !== undefined && performance.now() >= deadline) return;
      if (requests !== undefined && nextIndex >= requests) return;
      const current = nextIndex;
      nextIndex += 1;
      if (requests !== undefined && current >= requests) return;
      const route = schedule[current % schedule.length];
      results.push(await issueOne({ baseUrl, route, timeoutMs, bearerToken, fetchFn }));
    }
  }

  const workerCount = requests !== undefined ? Math.min(concurrency, requests) : concurrency;
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  const durationMs = performance.now() - started;
  return summarizeLevel({ concurrency, durationMs, results });
}

export async function runLoadTest(options, { fetchFn = fetch } = {}) {
  const schedule = buildSchedule(options.scenario, {
    pandaSlug: options.pandaSlug,
    hasToken: Boolean(options.bearerToken),
  });
  const levels = [];
  for (let i = 0; i < options.concurrency.length; i += 1) {
    const levelConcurrency = options.concurrency[i];
    levels.push(
      await runLoadLevel({
        baseUrl: options.baseUrl,
        schedule,
        concurrency: levelConcurrency,
        requests: options.requests,
        durationSec: options.durationSec,
        warmup: i === 0 ? options.warmup : 0,
        timeoutMs: options.timeoutMs,
        bearerToken: options.bearerToken,
        fetchFn,
      }),
    );
  }
  return {
    baseUrl: options.baseUrl,
    scenario: options.scenario,
    requestsPerLevel: options.requests ?? null,
    durationSecPerLevel: options.durationSec ?? null,
    warmup: options.warmup,
    authenticated: Boolean(options.bearerToken),
    levels,
  };
}

export function renderMarkdownReport(report) {
  const lines = [
    `## Load Test Report (${report.scenario})`,
    "",
    `- Target: \`${report.baseUrl}\``,
    `- Mode: ${report.requestsPerLevel !== null ? `${report.requestsPerLevel} requests/level` : `${report.durationSecPerLevel}s/level`} (warmup=${report.warmup}, authenticated=${report.authenticated})`,
    "",
    "| Concurrency | Requests | 2xx | 429 | 4xx | 5xx | Errors | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const level of report.levels) {
    lines.push(
      `| ${level.concurrency} | ${level.requests} | ${level.ok2xx} | ${level.rateLimited429} | ${level.client4xx} | ${level.server5xx} | ${level.networkErrors} | ${level.rps} | ${level.p50Ms} | ${level.p95Ms} | ${level.p99Ms} | ${level.maxMs} |`,
    );
  }
  const peak = report.levels[report.levels.length - 1];
  if (peak && peak.routes.length > 0) {
    lines.push(
      "",
      `### Per-Route Breakdown (Concurrency=${peak.concurrency})`,
      "",
      "| Route | Requests | 2xx | 429 | 5xx | Errors | p50 (ms) | p95 (ms) | Max (ms) |",
      "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const r of peak.routes) {
      lines.push(
        `| \`${r.route}\` | ${r.requests} | ${r.ok2xx} | ${r.rateLimited429} | ${r.server5xx} | ${r.networkErrors} | ${r.p50Ms} | ${r.p95Ms} | ${r.maxMs} |`,
      );
    }
  }
  return lines.join("\n");
}

export function renderTextReport(report) {
  const lines = [
    `Load test (${report.scenario}) against ${report.baseUrl}`,
  ];
  for (const level of report.levels) {
    lines.push(
      `c=${level.concurrency}: n=${level.requests} ok=${level.ok2xx} 429=${level.rateLimited429} 4xx=${level.client4xx} 5xx=${level.server5xx} err=${level.networkErrors} rps=${level.rps} p50=${level.p50Ms}ms p95=${level.p95Ms}ms p99=${level.p99Ms}ms max=${level.maxMs}ms`,
    );
  }
  return lines.join("\n");
}

function isMainModule() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const report = await runLoadTest(options);
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else if (options.format === "markdown") {
    console.log(renderMarkdownReport(report));
  } else {
    console.log(renderTextReport(report));
  }
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(`[load-test-api] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
