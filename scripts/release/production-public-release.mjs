import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RELEASE_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
const MEDIA_FILENAME_PATTERN = /^media-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{16}-w(?<width>\d{3,4})\.webp$/;
const DEFAULT_API_BASE = "https://api.zhipanda.com";
const DEFAULT_WEB_BASE = "https://zhipanda.com";
const DEFAULT_DATABASE = "panda-atlas";
const DEFAULT_BUCKET = "panda-atlas-media";
const DEFAULT_CONFIG = "services/worker-api/wrangler.jsonc";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const USER_AGENT = "PandaAtlas-Production-Release/1.0";

function assertReleaseVersion(value, label = "release") {
  if (typeof value !== "string" || !RELEASE_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY.MM.DD.N format.`);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function relative(filePath) {
  return path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
}

function npmInvocation(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && existsSync(npmCli)) {
    return { command: process.execPath, args: [npmCli, ...args] };
  }
  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args,
  };
}

function runCommand(label, command, args, { capture = false, retries = 0 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const result = spawnSync(command, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    if (!result.error && result.status === 0) {
      return capture ? result.stdout : "";
    }
    const detail = [result.error?.message, result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    lastError = new Error(`${label} failed${detail ? `:\n${detail}` : "."}`);
    if (attempt < retries) {
      process.stderr.write(`[production-release] retrying ${label} (${attempt + 2}/${retries + 1})\n`);
    }
  }
  throw lastError;
}

function runNpm(label, args, options) {
  const invocation = npmInvocation(args);
  return runCommand(label, invocation.command, invocation.args, options);
}

function gitOutput(args) {
  return runCommand(`git ${args.join(" ")}`, "git", args, { capture: true }).trim();
}

export function validateExecutionCheckout() {
  const branch = gitOutput(["branch", "--show-current"]);
  const head = gitOutput(["rev-parse", "HEAD"]);
  const originMaster = gitOutput(["rev-parse", "origin/master"]);
  const trackedChanges = gitOutput(["status", "--porcelain", "--untracked-files=no"]);
  if (branch !== "master") {
    throw new Error(`Production execution requires master; current branch is ${branch || "detached"}.`);
  }
  if (head !== originMaster) {
    throw new Error(`Production execution requires HEAD=${head} to match origin/master=${originMaster}.`);
  }
  if (trackedChanges) {
    throw new Error(`Production execution requires no tracked working-tree changes:\n${trackedChanges}`);
  }
  return { branch, head, origin_master: originMaster };
}

export function parsePublicMediaUrl(rawUrl, apiBase = DEFAULT_API_BASE) {
  const url = new URL(rawUrl);
  const expected = new URL(apiBase);
  if (url.protocol !== "https:" || url.origin !== expected.origin) {
    throw new Error(`Public media URL must use ${expected.origin}: ${rawUrl}`);
  }
  const match = url.pathname.match(/^\/media\/(releases\/([^/]+)\/([^/]+))$/);
  if (!match) {
    throw new Error(`Public media URL is not immutable and versioned: ${rawUrl}`);
  }
  const [, objectKey, releaseVersion, filename] = match;
  assertReleaseVersion(releaseVersion, "media release");
  const filenameMatch = MEDIA_FILENAME_PATTERN.exec(filename);
  if (!filenameMatch?.groups?.width) {
    throw new Error(`Public media filename is outside the Worker contract: ${filename}`);
  }
  const width = Number.parseInt(filenameMatch.groups.width, 10);
  if (width < 480 || width > 1200) {
    throw new Error(`Public media width must be between 480 and 1200: ${filename}`);
  }
  return { url: rawUrl, objectKey, releaseVersion, filename, width };
}

function validateManifestFiles(releaseDirectory, manifest) {
  for (const [filename, metadata] of Object.entries(manifest.files ?? {})) {
    const filePath = path.join(releaseDirectory, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Public Release manifest references missing file ${relative(filePath)}.`);
    }
    const actualBytes = statSync(filePath).size;
    const actualSha = sha256File(filePath);
    if (actualBytes !== metadata.bytes || actualSha !== metadata.sha256) {
      throw new Error(
        `Public Release file mismatch for ${filename}: expected bytes=${metadata.bytes} sha256=${metadata.sha256}, ` +
          `found bytes=${actualBytes} sha256=${actualSha}.`,
      );
    }
  }
}

export function collectPublicMedia(apiPayload, apiBase = DEFAULT_API_BASE) {
  const byUrl = new Map();
  for (const panda of apiPayload.pandas ?? []) {
    for (const media of panda.media ?? []) {
      if (media.status !== "available") continue;
      const candidates = [];
      if (media.url && media.bytes && media.sha256) {
        candidates.push({ url: media.url, bytes: media.bytes, sha256: media.sha256 });
      }
      for (const derivative of media.derivatives ?? []) {
        candidates.push(derivative);
      }
      if (candidates.length === 0) {
        throw new Error(`Available media ${media.id ?? "unknown"} has no verifiable object.`);
      }
      for (const candidate of candidates) {
        if (!candidate.url || !Number.isInteger(candidate.bytes) || !candidate.sha256) {
          throw new Error(`Media ${media.id ?? "unknown"} has incomplete integrity metadata.`);
        }
        const parsed = parsePublicMediaUrl(candidate.url, apiBase);
        const existing = byUrl.get(candidate.url);
        const entry = {
          ...parsed,
          bytes: candidate.bytes,
          sha256: candidate.sha256,
          pandaSlug: panda.slug,
          mediaId: media.id,
        };
        if (existing && (existing.bytes !== entry.bytes || existing.sha256 !== entry.sha256)) {
          throw new Error(`Conflicting integrity metadata for ${candidate.url}.`);
        }
        byUrl.set(candidate.url, existing ?? entry);
      }
    }
  }
  return [...byUrl.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

function localDerivativeCandidates(releaseVersion, filename) {
  return [
    path.join(repositoryRoot, ".media-work", releaseVersion, "derivatives", filename),
    path.join(repositoryRoot, ".media-work", releaseVersion, filename),
    path.join(repositoryRoot, ".media-work", "derivatives", filename),
  ];
}

function loadReleaseSpecificMedia(releaseVersion, publicMedia) {
  const manifestPath = path.join(
    repositoryRoot,
    "data",
    "reviewed-batches",
    releaseVersion,
    "media-manifest.json",
  );
  if (!existsSync(manifestPath)) return [];
  const manifest = readJson(manifestPath);
  if (manifest.batch_version !== releaseVersion) {
    throw new Error(`Reviewed media manifest version does not match ${releaseVersion}.`);
  }
  const publicByFilename = new Map(publicMedia.map((item) => [item.filename, item]));
  const uploads = [];
  const seen = new Set();
  for (const record of manifest.records ?? []) {
    for (const derivative of record.derivatives ?? []) {
      const filename = derivative.filename;
      if (!filename || seen.has(filename)) {
        throw new Error(`Invalid or duplicate reviewed media filename: ${String(filename)}.`);
      }
      seen.add(filename);
      const publicEntry = publicByFilename.get(filename);
      if (!publicEntry) {
        throw new Error(`Reviewed derivative ${filename} is not referenced by the Public Release API.`);
      }
      if (publicEntry.bytes !== derivative.bytes || publicEntry.sha256 !== derivative.sha256) {
        throw new Error(`Reviewed derivative metadata does not match Public Release API for ${filename}.`);
      }
      const localPath = localDerivativeCandidates(releaseVersion, filename).find(existsSync);
      if (!localPath) {
        throw new Error(`Missing local derivative ${filename}; regenerate the reviewed media work directory.`);
      }
      const actualBytes = statSync(localPath).size;
      const actualSha = sha256File(localPath);
      if (actualBytes !== derivative.bytes || actualSha !== derivative.sha256) {
        throw new Error(`Local derivative integrity mismatch for ${relative(localPath)}.`);
      }
      uploads.push({ ...publicEntry, localPath });
    }
  }
  return uploads.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export function inspectRelease(releaseVersion, apiBase = DEFAULT_API_BASE) {
  assertReleaseVersion(releaseVersion);
  const releaseDirectory = path.join(repositoryRoot, "data", "public-releases", releaseVersion);
  const manifestPath = path.join(releaseDirectory, "manifest.json");
  const apiPath = path.join(releaseDirectory, "api.json");
  if (!existsSync(manifestPath) || !existsSync(apiPath)) {
    throw new Error(`Missing immutable Public Release ${releaseVersion}.`);
  }
  const manifest = readJson(manifestPath);
  const api = readJson(apiPath);
  if (manifest.dataset_release_version !== releaseVersion) {
    throw new Error(`Manifest dataset version does not match ${releaseVersion}.`);
  }
  validateManifestFiles(releaseDirectory, manifest);
  if ((api.pandas ?? []).length !== manifest.record_counts?.api_pandas) {
    throw new Error(`API panda count does not match manifest for ${releaseVersion}.`);
  }
  const publicMedia = collectPublicMedia(api, apiBase);
  const releaseMedia = loadReleaseSpecificMedia(releaseVersion, publicMedia);
  return {
    releaseVersion,
    releaseDirectory,
    manifest,
    api,
    manifestSha256: sha256File(manifestPath),
    publicMedia,
    releaseMedia,
  };
}

function wranglerArgs(config, args) {
  return ["exec", "wrangler", "--", ...args, "--config", config];
}

function uploadReleaseMedia(artifact, options, report) {
  report.release_media = artifact.releaseMedia.map((item) => ({
    object_key: item.objectKey,
    bytes: item.bytes,
    sha256: item.sha256,
    action: options.execute ? "upload" : "would_upload",
  }));
  if (!options.execute) return;
  for (const item of artifact.releaseMedia) {
    runNpm(`R2 upload ${item.objectKey}`, wranglerArgs(options.config, [
      "r2",
      "object",
      "put",
      `${options.bucket}/${item.objectKey}`,
      "--file",
      item.localPath,
      "--content-type",
      "image/webp",
      "--cache-control",
      CACHE_CONTROL,
      "--remote",
      "--force",
    ]));
  }
}

function verifyRemoteR2(artifact, options) {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "pandaatlas-r2-release-"));
  try {
    const verified = [];
    for (const item of artifact.publicMedia) {
      const destination = path.join(temporaryDirectory, item.filename);
      runNpm(`R2 verify ${item.objectKey}`, wranglerArgs(options.config, [
        "r2",
        "object",
        "get",
        `${options.bucket}/${item.objectKey}`,
        "--file",
        destination,
        "--remote",
      ]), { capture: true });
      const bytes = statSync(destination).size;
      const sha = sha256File(destination);
      if (bytes !== item.bytes || sha !== item.sha256) {
        throw new Error(`Remote R2 integrity mismatch for ${item.objectKey}.`);
      }
      verified.push({ object_key: item.objectKey, bytes, sha256: sha });
    }
    return verified;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, { method = "GET", attempts = 4 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        redirect: "follow",
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(750 * attempt);
    }
  }
  throw new Error(`Request failed for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function verifyMediaHttp(artifact) {
  const verified = [];
  for (const item of artifact.publicMedia) {
    const response = await fetchWithRetry(item.url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha = sha256Bytes(bytes);
    if (bytes.length !== item.bytes || sha !== item.sha256) {
      throw new Error(`HTTP media integrity mismatch for ${item.url}.`);
    }
    if (response.headers.get("content-type") !== "image/webp") {
      throw new Error(`HTTP media content type is not image/webp for ${item.url}.`);
    }
    verified.push({
      url: item.url,
      status: response.status,
      bytes: bytes.length,
      sha256: sha,
      cache_control: response.headers.get("cache-control"),
    });
  }
  return verified;
}

async function fetchCurrentRelease(apiBase) {
  const response = await fetchWithRetry(`${apiBase}/api/v1/releases/current`);
  const body = await response.json();
  return {
    body,
    version: body.dataset_release_version,
    headers: {
      dataset: response.headers.get("x-pandaatlas-dataset-version"),
      schema: response.headers.get("x-pandaatlas-public-schema-version"),
      migration: response.headers.get("x-pandaatlas-database-migration-version"),
    },
  };
}

async function smokeApi(artifact, apiBase) {
  const current = await fetchCurrentRelease(apiBase);
  if (current.version !== artifact.releaseVersion || current.headers.dataset !== artifact.releaseVersion) {
    throw new Error(`API current release mismatch: expected ${artifact.releaseVersion}, found ${current.version}.`);
  }
  if (current.headers.schema !== artifact.manifest.public_schema_version) {
    throw new Error(`API public schema header mismatch for ${artifact.releaseVersion}.`);
  }
  if (current.headers.migration !== artifact.manifest.database_migration_version) {
    throw new Error(`API migration header mismatch for ${artifact.releaseVersion}.`);
  }
  const compared = [];
  for (const expected of artifact.api.pandas ?? []) {
    const response = await fetchWithRetry(`${apiBase}/api/v1/pandas/${encodeURIComponent(expected.slug)}`);
    const actual = await response.json();
    if (!isDeepStrictEqual(actual, expected)) {
      throw new Error(`API profile payload differs from immutable artifact for ${expected.slug}.`);
    }
    compared.push(expected.slug);
  }
  return {
    current_release: current.version,
    compared_profile_count: compared.length,
    profiles: compared,
  };
}

async function smokeWeb(artifact, webBase) {
  const checked = [];
  for (const panda of artifact.api.pandas ?? []) {
    const url = `${webBase}/zh/atlas/${encodeURIComponent(panda.slug)}?release-check=${encodeURIComponent(artifact.releaseVersion)}`;
    const response = await fetchWithRetry(url);
    const html = await response.text();
    if (!html.includes(artifact.releaseVersion)) {
      throw new Error(`Web profile ${panda.slug} does not expose release ${artifact.releaseVersion}.`);
    }
    const identity = panda.name_zh || panda.name_en || panda.slug;
    if (!html.includes(identity)) {
      throw new Error(`Web profile ${panda.slug} does not contain its reviewed identity label.`);
    }
    checked.push({ slug: panda.slug, status: response.status });
  }
  return { checked_profile_count: checked.length, profiles: checked };
}

function explicitReportPath(options, name) {
  const reportPath = options.report
    ? path.resolve(repositoryRoot, options.report)
    : path.join(repositoryRoot, ".release-gate", name);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  return reportPath;
}

function writeReport(reportPath, report) {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function d1ActivationArgs(options, execute, reportPath) {
  return [
    "run",
    execute ? "release:d1:apply" : "release:d1:preflight",
    "--",
    "--release",
    options.release,
    "--database",
    options.database,
    "--config",
    options.config,
    "--remote",
    "--report",
    reportPath,
  ];
}

function d1RollbackArgs(options, target, execute, reportPath) {
  return [
    "run",
    execute ? "release:d1:rollback" : "release:d1:rollback:preflight",
    "--",
    "--to",
    target,
    "--database",
    options.database,
    "--config",
    options.config,
    "--remote",
    "--report",
    reportPath,
  ];
}

function runD1Activation(options, execute, reportPath) {
  runNpm(`D1 ${execute ? "activation" : "preflight"}`, d1ActivationArgs(options, execute, reportPath));
  return readJson(reportPath);
}

function runD1Rollback(options, target, execute, reportPath) {
  runNpm(`D1 rollback ${execute ? "execution" : "preflight"} to ${target}`, d1RollbackArgs(options, target, execute, reportPath));
  return readJson(reportPath);
}

function validateWebFallbackVersion(releaseVersion) {
  const generator = readFileSync(
    path.join(repositoryRoot, "scripts", "golden-dataset", "generate-web-identity-aliases.mjs"),
    "utf8",
  );
  if (!generator.includes(`WEB_RELEASE_VERSION = "${releaseVersion}"`)) {
    throw new Error(`Web fallback is not bound to Public Release ${releaseVersion}.`);
  }
}

export function parseArguments(argv = process.argv.slice(2)) {
  const options = {
    execute: false,
    drill: false,
    release: null,
    rollbackTarget: null,
    apiBase: DEFAULT_API_BASE,
    webBase: DEFAULT_WEB_BASE,
    database: DEFAULT_DATABASE,
    bucket: DEFAULT_BUCKET,
    config: DEFAULT_CONFIG,
    report: null,
    skipGate: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") options.execute = true;
    else if (argument === "--drill") options.drill = true;
    else if (argument === "--skip-gate") options.skipGate = true;
    else if (argument === "--release") options.release = argv[++index];
    else if (argument === "--rollback-target") options.rollbackTarget = argv[++index];
    else if (argument === "--api-base") options.apiBase = argv[++index];
    else if (argument === "--web-base") options.webBase = argv[++index];
    else if (argument === "--database") options.database = argv[++index];
    else if (argument === "--bucket") options.bucket = argv[++index];
    else if (argument === "--config") options.config = argv[++index];
    else if (argument === "--report") options.report = argv[++index];
    else throw new Error(`Unknown production release argument: ${argument}`);
  }
  options.release = assertReleaseVersion(options.release);
  if (options.rollbackTarget) assertReleaseVersion(options.rollbackTarget, "rollback target");
  if (options.drill && !options.rollbackTarget) {
    throw new Error("--drill requires --rollback-target.");
  }
  if (options.execute && options.skipGate && !options.drill) {
    throw new Error("Production execution cannot use --skip-gate.");
  }
  return options;
}

async function runProduction(options) {
  const reportPath = explicitReportPath(options, `production-release-${options.release}.json`);
  const report = {
    schema_version: 1,
    operation: "production-public-release",
    outcome: "failed",
    mode: options.execute ? "execute" : "dry-run",
    release: options.release,
    started_at: new Date().toISOString(),
    steps: {},
  };
  let activated = false;
  let rollbackVersion = null;
  try {
    const artifact = inspectRelease(options.release, options.apiBase);
    report.artifact = {
      manifest_sha256: artifact.manifestSha256,
      api_pandas: artifact.manifest.record_counts.api_pandas,
      public_media_objects: artifact.publicMedia.length,
      release_media_objects: artifact.releaseMedia.length,
    };
    validateWebFallbackVersion(options.release);
    report.steps.web_fallback = { outcome: "passed", release: options.release };

    if (options.execute) {
      report.checkout = validateExecutionCheckout();
    }
    if (!options.skipGate) {
      runNpm("private collection Release Gate", ["run", "release:private"]);
      report.steps.release_gate = { outcome: "passed" };
    } else {
      report.steps.release_gate = { outcome: "skipped" };
    }

    const currentBefore = await fetchCurrentRelease(options.apiBase);
    report.current_before = currentBefore.version;
    if (currentBefore.version !== options.release) {
      const preflightPath = path.join(repositoryRoot, ".release-gate", `production-d1-preflight-${options.release}.json`);
      const preflight = runD1Activation(options, false, preflightPath);
      rollbackVersion = preflight.preflight.current_release;
      report.steps.d1_preflight = preflight;
    } else {
      rollbackVersion = null;
      report.steps.d1_preflight = { outcome: "passed", state: "already_current" };
    }

    uploadReleaseMedia(artifact, options, report);
    report.steps.r2_remote = {
      outcome: "passed",
      objects: verifyRemoteR2(artifact, options),
    };

    if (options.execute) {
      runNpm("API deployment", ["run", "deploy:api:cf"], { retries: 2 });
      report.steps.api_deploy = { outcome: "passed" };
    } else {
      report.steps.api_deploy = { outcome: "planned" };
    }

    report.steps.media_http = {
      outcome: "passed",
      objects: await verifyMediaHttp(artifact),
    };

    if (options.execute && currentBefore.version !== options.release) {
      const activationPath = path.join(repositoryRoot, ".release-gate", `production-d1-activation-${options.release}.json`);
      report.steps.d1_activation = runD1Activation(options, true, activationPath);
      activated = true;
    } else if (currentBefore.version === options.release) {
      report.steps.d1_activation = { outcome: "passed", state: "already_current" };
    } else {
      report.steps.d1_activation = { outcome: "planned" };
    }

    if (options.execute) {
      report.steps.api_smoke = { outcome: "passed", ...(await smokeApi(artifact, options.apiBase)) };
      runNpm("Web deployment", ["run", "deploy:web:cf"], { retries: 2 });
      report.steps.web_deploy = { outcome: "passed" };
      report.steps.web_smoke = { outcome: "passed", ...(await smokeWeb(artifact, options.webBase)) };
      report.steps.media_http_after_web = {
        outcome: "passed",
        objects: await verifyMediaHttp(artifact),
      };
    } else {
      report.steps.api_smoke = { outcome: "planned" };
      report.steps.web_deploy = { outcome: "planned" };
      report.steps.web_smoke = { outcome: "planned" };
    }

    report.outcome = "passed";
    report.finished_at = new Date().toISOString();
    writeReport(reportPath, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    if (options.execute && activated && rollbackVersion) {
      try {
        const rollbackReportPath = path.join(
          repositoryRoot,
          ".release-gate",
          `production-auto-rollback-${options.release}-to-${rollbackVersion}.json`,
        );
        report.automatic_rollback = runD1Rollback(options, rollbackVersion, true, rollbackReportPath);
      } catch (rollbackError) {
        report.automatic_rollback = {
          outcome: "failed",
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        };
      }
    }
    report.finished_at = new Date().toISOString();
    writeReport(reportPath, report);
    throw error;
  }
}

async function runDrill(options) {
  const targetArtifact = inspectRelease(options.rollbackTarget, options.apiBase);
  const sourceArtifact = inspectRelease(options.release, options.apiBase);
  const reportPath = explicitReportPath(
    options,
    `production-release-drill-${options.release}-to-${options.rollbackTarget}.json`,
  );
  const report = {
    schema_version: 1,
    operation: "production-public-release-rollback-drill",
    outcome: "failed",
    mode: options.execute ? "execute" : "dry-run",
    source_release: options.release,
    rollback_target: options.rollbackTarget,
    started_at: new Date().toISOString(),
    steps: {},
  };
  let switchedToTarget = false;
  try {
    if (options.execute) report.checkout = validateExecutionCheckout();
    const current = await fetchCurrentRelease(options.apiBase);
    if (current.version !== options.release) {
      throw new Error(`Rollback drill requires current release ${options.release}; found ${current.version}.`);
    }
    report.steps.source_api_smoke = { outcome: "passed", ...(await smokeApi(sourceArtifact, options.apiBase)) };
    report.steps.source_media_http = { outcome: "passed", objects: await verifyMediaHttp(sourceArtifact) };

    const toTargetPreflightPath = path.join(
      repositoryRoot,
      ".release-gate",
      `drill-rollback-preflight-${options.release}-to-${options.rollbackTarget}.json`,
    );
    report.steps.rollback_preflight = runD1Rollback(
      options,
      options.rollbackTarget,
      false,
      toTargetPreflightPath,
    );
    if (!options.execute) {
      report.steps.rollback = { outcome: "planned" };
      report.steps.restore = { outcome: "planned" };
      report.outcome = "passed";
      report.finished_at = new Date().toISOString();
      writeReport(reportPath, report);
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report;
    }

    const toTargetPath = path.join(
      repositoryRoot,
      ".release-gate",
      `drill-rollback-${options.release}-to-${options.rollbackTarget}.json`,
    );
    report.steps.rollback = runD1Rollback(options, options.rollbackTarget, true, toTargetPath);
    switchedToTarget = true;
    report.steps.target_api_smoke = { outcome: "passed", ...(await smokeApi(targetArtifact, options.apiBase)) };
    report.steps.target_media_http = { outcome: "passed", objects: await verifyMediaHttp(targetArtifact) };
    report.steps.target_web_smoke = { outcome: "passed", ...(await smokeWeb(targetArtifact, options.webBase)) };

    const restorePreflightPath = path.join(
      repositoryRoot,
      ".release-gate",
      `drill-restore-preflight-${options.rollbackTarget}-to-${options.release}.json`,
    );
    report.steps.restore_preflight = runD1Rollback(
      options,
      options.release,
      false,
      restorePreflightPath,
    );
    const restorePath = path.join(
      repositoryRoot,
      ".release-gate",
      `drill-restore-${options.rollbackTarget}-to-${options.release}.json`,
    );
    report.steps.restore = runD1Rollback(options, options.release, true, restorePath);
    switchedToTarget = false;
    report.steps.restored_api_smoke = { outcome: "passed", ...(await smokeApi(sourceArtifact, options.apiBase)) };
    report.steps.restored_media_http = { outcome: "passed", objects: await verifyMediaHttp(sourceArtifact) };
    report.steps.restored_web_smoke = { outcome: "passed", ...(await smokeWeb(sourceArtifact, options.webBase)) };

    report.outcome = "passed";
    report.finished_at = new Date().toISOString();
    writeReport(reportPath, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    if (options.execute && switchedToTarget) {
      try {
        const emergencyPath = path.join(
          repositoryRoot,
          ".release-gate",
          `drill-emergency-restore-${options.rollbackTarget}-to-${options.release}.json`,
        );
        report.emergency_restore = runD1Rollback(options, options.release, true, emergencyPath);
      } catch (restoreError) {
        report.emergency_restore = {
          outcome: "failed",
          error: restoreError instanceof Error ? restoreError.message : String(restoreError),
        };
      }
    }
    report.finished_at = new Date().toISOString();
    writeReport(reportPath, report);
    throw error;
  }
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  return options.drill ? runDrill(options) : runProduction(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
