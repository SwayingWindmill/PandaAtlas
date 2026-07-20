import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runActivation } from "./apply-public-release-d1.mjs";
import {
  buildD1ImportBatchSql,
  inspectPublicReleaseArtifact,
  querySingleD1Row,
  runWranglerD1,
  writeJsonReport,
} from "./d1-public-release.mjs";
import {
  BASELINE_RELEASE,
  CURRENT_RELEASE,
  PRODUCTION_MEDIA_BUCKET,
  ROLLBACK_RELEASE,
  STAGING_DATABASE_NAME,
  STAGING_MEDIA_BUCKET,
  assertBaselineHttpEvidence,
  assertEntityWithdrawalHttpEvidence,
  assertProductionCanaryEvidence,
  assertWholeReleaseHttpEvidence,
  buildBaselineVerificationSql,
  buildEntityWithdrawalSql,
  buildEntityWithdrawalVerificationSql,
  buildStagingReleaseResetSql,
  buildWholeReleaseVerificationSql,
  buildWholeReleaseWithdrawalSql,
  defaultStagingConfigPath,
  parseWranglerRows,
  readStagingConfig,
  repositoryRoot,
  reviewedMediaObjects,
  runCommand,
  runWithBoundedRetry,
  sha256,
  stagingConfigChecksum,
  validateBaselineVerification,
  validateEntityWithdrawalVerification,
  validateStagingBaseUrl,
  validateStagingConfig,
  validateWholeReleaseVerification,
} from "./api-staging-withdrawal.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const wranglerCli = path.join(repositoryRoot, "node_modules/wrangler/bin/wrangler.js");
const productionConfigPath = path.join(repositoryRoot, "services/worker-api/wrangler.jsonc");
const migrationScriptPath = path.join(repositoryRoot, "scripts/release/apply-d1-migrations.mjs");
const apiReleasePath = path.join(
  repositoryRoot,
  "data/public-releases",
  CURRENT_RELEASE,
  "api.json",
);
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const ACTIONS = new Set(["plan", "bootstrap", "deploy", "drill", "full"]);

function parseArguments(argv) {
  const options = {
    action: "plan",
    config: defaultStagingConfigPath,
    baseUrl: null,
    report: path.join(repositoryRoot, ".release-gate/api-staging-withdrawal.json"),
    execute: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--action", "--config", "--base-url", "--report"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--action") options.action = value;
      if (argument === "--config") options.config = path.resolve(repositoryRoot, value);
      if (argument === "--base-url") options.baseUrl = value.replace(/\/+$/, "");
      if (argument === "--report") options.report = path.resolve(repositoryRoot, value);
      continue;
    }
    if (argument === "--execute") {
      options.execute = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!ACTIONS.has(options.action)) throw new Error(`Unsupported action: ${options.action}`);
  if (options.action !== "plan" && !options.execute) {
    throw new Error(`${options.action} requires explicit --execute.`);
  }
  if (options.action === "drill" && !options.baseUrl) {
    throw new Error("drill requires --base-url.");
  }
  return options;
}

function gitCommit() {
  return runCommand("git", ["rev-parse", "HEAD"], { capture: true }).stdout.trim();
}

function d1Options(configPath) {
  return {
    database: STAGING_DATABASE_NAME,
    config: configPath,
    target: "--remote",
    persistTo: null,
  };
}

function executeD1(configPath, sql, { json = false, label = "D1 command" } = {}) {
  const args = ["--command", sql, "--yes"];
  if (json) args.push("--json");
  const stdout = runWranglerD1(d1Options(configPath), args, { capture: json });
  return json ? parseWranglerRows(stdout, label) : null;
}

async function resetAndMigrate(configPath, report) {
  executeD1(configPath, buildStagingReleaseResetSql());
  report.steps.push({ id: "release-storage-reset", status: "passed" });
  await runRetryableCommand(process.execPath, [
    migrationScriptPath,
    "--database",
    STAGING_DATABASE_NAME,
    "--config",
    configPath,
    "--remote",
  ], { label: "Staging D1 migration runner", attempts: 8, delayMs: 2000 });
  report.steps.push({ id: "d1-migrations", status: "passed" });
}

function seedBaseline(configPath, report) {
  const artifact = inspectPublicReleaseArtifact(BASELINE_RELEASE);
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "panda-atlas-staging-seed-"));
  try {
    const sqlPath = path.join(temporaryDirectory, `release-${BASELINE_RELEASE}.sql`);
    const sourceSql = readFileSync(artifact.sqlPath, "utf8");
    writeFileSync(sqlPath, buildD1ImportBatchSql(sourceSql, BASELINE_RELEASE), "utf8");
    runWranglerD1(d1Options(configPath), ["--file", sqlPath, "--yes"]);
    const row = querySingleD1Row(
      d1Options(configPath),
      buildBaselineVerificationSql(),
      "Staging baseline verification",
    );
    validateBaselineVerification(row, artifact);
    report.steps.push({
      id: "baseline-release",
      status: "passed",
      release: BASELINE_RELEASE,
      records: artifact.expectedRecords,
      api_pandas: artifact.expectedApiPandas,
    });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function activateExpandedReleases(configPath, report) {
  for (const release of [ROLLBACK_RELEASE, CURRENT_RELEASE]) {
    const activationReport = path.join(
      repositoryRoot,
      ".release-gate",
      `api-staging-activation-${release}.json`,
    );
    runActivation([
      "--database",
      STAGING_DATABASE_NAME,
      "--config",
      configPath,
      "--remote",
      "--release",
      release,
      "--execute",
      "--report",
      activationReport,
    ]);
    report.steps.push({ id: `activate-${release}`, status: "passed", release });
  }
}

function wranglerArgs(...args) {
  return [wranglerCli, ...args];
}

function relayCommandOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

async function runRetryableCommand(
  command,
  args,
  { label, attempts = 6, delayMs = 1000 } = {},
) {
  return runWithBoundedRetry(
    () => {
      const result = runCommand(command, args, { capture: true });
      relayCommandOutput(result);
      return result;
    },
    {
      attempts,
      delayMs,
      onRetry(error, attempt, maximumAttempts) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(
          "[staging-retry] " + (label ?? command) + " failed on attempt " + attempt + "/" + maximumAttempts + ": " + detail,
        );
      },
    },
  );
}

function verifyFile(filename, expected, label) {
  const actualBytes = statSync(filename).size;
  const actualHash = sha256(readFileSync(filename));
  if (actualBytes !== expected.bytes) {
    throw new Error(`${label} byte-size mismatch: expected ${expected.bytes}; got ${actualBytes}.`);
  }
  if (actualHash !== expected.sha256) {
    throw new Error(`${label} SHA-256 mismatch: expected ${expected.sha256}; got ${actualHash}.`);
  }
}

async function copyReviewedMedia(configPath, report) {
  const objects = reviewedMediaObjects();
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "panda-atlas-staging-media-"));
  try {
    for (const [index, object] of objects.entries()) {
      const sourcePath = path.join(temporaryDirectory, "source-" + index + ".webp");
      const verifyPath = path.join(temporaryDirectory, "verify-" + index + ".webp");
      await runRetryableCommand(process.execPath, wranglerArgs(
        "r2", "object", "get", PRODUCTION_MEDIA_BUCKET + "/" + object.objectKey,
        "--file", sourcePath,
        "--remote",
        "--config", productionConfigPath,
      ), { label: "Production R2 get " + object.objectKey });
      verifyFile(sourcePath, object, "Production R2 " + object.objectKey);
      await runRetryableCommand(process.execPath, wranglerArgs(
        "r2", "object", "put", STAGING_MEDIA_BUCKET + "/" + object.objectKey,
        "--file", sourcePath,
        "--content-type", "image/webp",
        "--cache-control", CACHE_CONTROL,
        "--remote",
        "--force",
        "--config", configPath,
      ), { label: "Staging R2 put " + object.objectKey });
      await runRetryableCommand(process.execPath, wranglerArgs(
        "r2", "object", "get", STAGING_MEDIA_BUCKET + "/" + object.objectKey,
        "--file", verifyPath,
        "--remote",
        "--config", configPath,
      ), { label: "Staging R2 verify " + object.objectKey });
      verifyFile(verifyPath, object, "Staging R2 " + object.objectKey);
    }
    report.steps.push({ id: "media-copy", status: "passed", objects: objects.length });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function bootstrap(configPath, report) {
  await resetAndMigrate(configPath, report);
  seedBaseline(configPath, report);
  activateExpandedReleases(configPath, report);
  await copyReviewedMedia(configPath, report);
}

function parseDeployment(output) {
  const combined = output.replaceAll("\r", "");
  const rawUrl = combined.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? null;
  const versionId = combined.match(/Version ID:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
  if (!rawUrl || !versionId) {
    throw new Error(`Could not parse immutable Staging deployment identity: ${combined}`);
  }
  return { url: validateStagingBaseUrl(rawUrl), version_id: versionId };
}

function deploy(configPath, report) {
  const result = runCommand(process.execPath, wranglerArgs(
    "deploy",
    "--config", configPath,
  ), { capture: true });
  const deployment = parseDeployment(`${result.stdout}\n${result.stderr}`);
  report.deployment = deployment;
  report.steps.push({ id: "worker-deploy", status: "passed", ...deployment });
  return deployment;
}

function releaseFixture() {
  const release = JSON.parse(readFileSync(apiReleasePath, "utf8"));
  const bySlug = new Map(release.pandas.map((panda) => [panda.slug, panda]));
  const required = ["ri-ri", "shin-shin", "xiao-xiao", "lei-lei"].map((slug) => {
    const panda = bySlug.get(slug);
    if (!panda) throw new Error(`Release fixture is missing ${slug}.`);
    return panda;
  });
  const [riRi, shinShin, xiaoXiao, leiLei] = required;
  if (xiaoXiao.father_id !== riRi.id || xiaoXiao.mother_id !== shinShin.id) {
    throw new Error("Xiao Xiao parentage fixture drifted.");
  }
  if (leiLei.father_id !== riRi.id || leiLei.mother_id !== shinShin.id) {
    throw new Error("Lei Lei parentage fixture drifted.");
  }
  const mediaKeys = (panda) =>
    panda.media[0].derivatives.map((item) =>
      new URL(item.url).pathname.replace(/^\/media\//, ""),
    );
  return {
    required,
    target: riRi,
    unrelated: shinShin,
    targetMediaKeys: mediaKeys(riRi),
    retainedMediaKeys: mediaKeys(shinShin),
    targetPrimaryMediaKey: new URL(riRi.media[0].url).pathname.replace(/^\/media\//, ""),
  };
}

async function fetchEvidence(baseUrl, requestPath, { json = true, method = "GET" } = {}) {
  const response = await fetch(`${baseUrl}${requestPath}`, { method });
  const body = json && method !== "HEAD"
    ? await response.text().then((text) => {
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })
    : null;
  return {
    path: requestPath,
    status: response.status,
    body,
    datasetVersion: response.headers.get("X-PandaAtlas-Dataset-Version"),
    publicSchemaVersion: response.headers.get("X-PandaAtlas-Public-Schema-Version"),
    migrationVersion: response.headers.get("X-PandaAtlas-Database-Migration-Version"),
    contentType: response.headers.get("Content-Type"),
    cacheControl: response.headers.get("Cache-Control"),
    contentLength: response.headers.get("Content-Length"),
    etag: response.headers.get("ETag"),
  };
}

async function baselineHttp(baseUrl, fixture) {
  const release = await fetchEvidence(baseUrl, "/api/v1/releases/current");
  const pandas = await Promise.all(
    fixture.required.map((panda) => fetchEvidence(baseUrl, `/api/v1/pandas/${panda.slug}`)),
  );
  for (const [index, evidence] of pandas.entries()) {
    const expected = fixture.required[index];
    if (evidence.status !== 200 || evidence.body?.id !== expected.id) {
      throw new Error(`Staging panda ${expected.slug} baseline drifted.`);
    }
    if (evidence.body?.media?.length !== 1 || evidence.body.media[0]?.status !== "available") {
      throw new Error(`Staging panda ${expected.slug} media baseline drifted.`);
    }
  }
  const [riRi, shinShin, xiaoXiao, leiLei] = pandas.map((item) => item.body);
  for (const twin of [xiaoXiao, leiLei]) {
    if (twin?.father_id !== riRi.id || twin?.mother_id !== shinShin.id) {
      throw new Error(`Staging Ueno parentage drifted for ${String(twin?.slug)}.`);
    }
  }
  const media = await fetchEvidence(baseUrl, `/media/${fixture.targetPrimaryMediaKey}`, {
    json: false,
    method: "HEAD",
  });
  const evidence = { release, pandas, media };
  assertBaselineHttpEvidence(evidence);
  return evidence;
}

async function baselineHttpWithPropagationRetry(baseUrl, fixture) {
  return runWithBoundedRetry(
    () => baselineHttp(baseUrl, fixture),
    {
      attempts: 6,
      delayMs: 1500,
      shouldRetry: () => true,
      onRetry(error, attempt, maximumAttempts) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(
          "[staging-retry] workers.dev baseline failed on attempt " + attempt + "/" + maximumAttempts + ": " + detail,
        );
      },
    },
  );
}

function appendEntityWithdrawal(configPath, fixture, report) {
  const withdrawnAt = new Date().toISOString();
  const row = executeD1(configPath, buildEntityWithdrawalSql({
    pandaId: fixture.target.id,
    reason: "Staging licensed-media withdrawal drill",
    withdrawnAt,
  }), { json: true, label: "Entity withdrawal insert" });
  const verification = querySingleD1Row(
    d1Options(configPath),
    buildEntityWithdrawalVerificationSql({
      pandaId: fixture.target.id,
      unrelatedPandaId: fixture.unrelated.id,
    }),
    "Entity withdrawal verification",
  );
  validateEntityWithdrawalVerification(verification);
  report.steps.push({
    id: "entity-withdrawal",
    status: "passed",
    withdrawal_id: row.id,
    panda_id: fixture.target.id,
    withdrawn_at: withdrawnAt,
  });
}

function deleteWithdrawnMedia(configPath, fixture, report) {
  for (const objectKey of fixture.targetMediaKeys) {
    runCommand(process.execPath, wranglerArgs(
      "r2", "object", "delete", `${STAGING_MEDIA_BUCKET}/${objectKey}`,
      "--remote",
      "--force",
      "--config", configPath,
    ));
  }
  report.steps.push({
    id: "withdrawn-media-delete",
    status: "passed",
    object_keys: fixture.targetMediaKeys,
  });
}

async function entityWithdrawalHttp(baseUrl, fixture) {
  const evidence = {
    release: await fetchEvidence(baseUrl, "/api/v1/releases/current"),
    targetPanda: await fetchEvidence(baseUrl, `/api/v1/pandas/${fixture.target.slug}`),
    unrelatedPanda: await fetchEvidence(baseUrl, `/api/v1/pandas/${fixture.unrelated.slug}`),
    withdrawnMedia: await Promise.all(
      fixture.targetMediaKeys.map((objectKey) =>
        fetchEvidence(baseUrl, `/media/${objectKey}`, { json: false, method: "HEAD" }),
      ),
    ),
    retainedMedia: await Promise.all(
      fixture.retainedMediaKeys.map((objectKey) =>
        fetchEvidence(baseUrl, `/media/${objectKey}`, { json: false, method: "HEAD" }),
      ),
    ),
  };
  assertEntityWithdrawalHttpEvidence(evidence);
  return evidence;
}

function appendWholeReleaseWithdrawal(configPath, report) {
  const withdrawnAt = new Date().toISOString();
  const row = executeD1(configPath, buildWholeReleaseWithdrawalSql({
    reason: "Staging whole-release withdrawal drill",
    withdrawnAt,
  }), { json: true, label: "Whole-release withdrawal insert" });
  const verification = querySingleD1Row(
    d1Options(configPath),
    buildWholeReleaseVerificationSql(),
    "Whole-release withdrawal verification",
  );
  validateWholeReleaseVerification(verification);
  report.steps.push({
    id: "whole-release-withdrawal",
    status: "passed",
    withdrawal_id: row.id,
    withdrawn_at: withdrawnAt,
    retained_records: verification.retained_record_rows,
  });
}

async function wholeReleaseHttp(baseUrl) {
  const evidence = {
    release: await fetchEvidence(baseUrl, "/api/v1/releases/current"),
    pandas: await fetchEvidence(baseUrl, "/api/v1/pandas?page_size=1"),
  };
  assertWholeReleaseHttpEvidence(evidence);
  return evidence;
}

async function drill(configPath, baseUrl, report) {
  const fixture = releaseFixture();
  const productionBefore = await fetchEvidence(
    "https://api.zhipanda.com",
    "/api/v1/releases/current",
  );
  report.http = {
    production_canary: { before: productionBefore },
    baseline: await baselineHttpWithPropagationRetry(baseUrl, fixture),
  };
  appendEntityWithdrawal(configPath, fixture, report);
  deleteWithdrawnMedia(configPath, fixture, report);
  report.http.entity_withdrawal = await entityWithdrawalHttp(baseUrl, fixture);
  appendWholeReleaseWithdrawal(configPath, report);
  report.http.whole_release_withdrawal = await wholeReleaseHttp(baseUrl);
  const productionAfter = await fetchEvidence(
    "https://api.zhipanda.com",
    "/api/v1/releases/current",
  );
  assertProductionCanaryEvidence(productionBefore, productionAfter);
  report.http.production_canary.after = productionAfter;
}

function planReport(options, config, identity) {
  return {
    schema_version: 1,
    operation: "api-staging-withdrawal-drill",
    outcome: "planned",
    mode: "dry-run",
    action: options.action,
    configuration: {
      worker: identity.workerName,
      database: identity.databaseName,
      database_id: identity.databaseId,
      media_bucket: identity.mediaBucket,
      geo_bucket: identity.geoBucket,
      routes: config.routes,
      app_env: config.vars.APP_ENV,
    },
    releases: {
      baseline: BASELINE_RELEASE,
      rollback: ROLLBACK_RELEASE,
      current: CURRENT_RELEASE,
    },
    planned_steps: [
      "guard staging identities before every remote command",
      "reset only versioned Public Release storage",
      "replay tracked D1 migrations",
      `seed ${BASELINE_RELEASE}`,
      `activate ${ROLLBACK_RELEASE} and ${CURRENT_RELEASE}`,
      "copy and verify reviewed immutable media into staging R2",
      "deploy workers.dev-only staging Worker",
      "verify baseline HTTP delivery",
      "append entity withdrawal and delete only the staging media object",
      "append whole-release withdrawal and verify HTTP 410",
    ],
    frontend_architecture_limitation:
      "Profile pages consume build-time Public Release data and are not claimed to update dynamically from D1 withdrawal.",
  };
}

export async function runApiStagingWithdrawal(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const startedAt = new Date().toISOString();
  const config = readStagingConfig(options.config);
  const identity = validateStagingConfig(config, { allowPlaceholder: options.action === "plan" });
  if (options.baseUrl) options.baseUrl = validateStagingBaseUrl(options.baseUrl);
  if (options.action === "plan") {
    const report = planReport(options, config, identity);
    report.started_at = startedAt;
    report.finished_at = new Date().toISOString();
    writeJsonReport(options.report, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  }

  const report = {
    schema_version: 1,
    operation: "api-staging-withdrawal-drill",
    outcome: "failed",
    mode: "execute",
    action: options.action,
    started_at: startedAt,
    commit_sha: gitCommit(),
    config_sha256: stagingConfigChecksum(options.config),
    configuration: identity,
    releases: {
      baseline: BASELINE_RELEASE,
      rollback: ROLLBACK_RELEASE,
      current: CURRENT_RELEASE,
    },
    frontend_architecture_limitation:
      "Profile pages consume build-time Public Release data and are not claimed to update dynamically from D1 withdrawal.",
    steps: [],
  };
  try {
    if (["bootstrap", "full"].includes(options.action)) await bootstrap(options.config, report);
    let baseUrl = options.baseUrl;
    if (["deploy", "full"].includes(options.action)) {
      baseUrl = deploy(options.config, report).url;
    }
    if (["drill", "full"].includes(options.action)) {
      if (!baseUrl) throw new Error("Withdrawal drill has no immutable Staging deployment URL.");
      report.deployment ??= { url: baseUrl, version_id: "externally-supplied" };
      await drill(options.config, baseUrl, report);
    }
    report.outcome = "passed";
    report.finished_at = new Date().toISOString();
    writeJsonReport(options.report, report);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.finished_at = new Date().toISOString();
    writeJsonReport(options.report, report);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runApiStagingWithdrawal().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
