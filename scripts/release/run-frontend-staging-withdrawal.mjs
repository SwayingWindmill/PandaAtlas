import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runWithBoundedRetry } from "./api-staging-withdrawal.mjs";
import {
  STAGING_WORKER_NAME,
  WITHDRAWAL_ID,
  assertDirectory,
  baselineConfigPath,
  inspectWebStagingConfigs,
  inspectWithdrawalArtifact,
  parseActiveDeployment,
  parseDeploymentOutput,
  readJson,
  repositoryRoot,
  sha256,
  treeSha256,
  validateBrowserEvidence,
  validateProductionCanary,
  validateWebStagingBaseUrl,
  webRoot,
  withdrawnConfigPath,
} from "./frontend-staging-withdrawal.mjs";

const wranglerCli = path.join(repositoryRoot, "node_modules/wrangler/bin/wrangler.js");
const openNextCli = path.join(
  repositoryRoot,
  "node_modules/@opennextjs/cloudflare/dist/cli/index.js",
);
const browserScript = path.join(webRoot, "scripts/verify-frontend-staging-withdrawal.mjs");
const evidenceRoot = path.join(repositoryRoot, ".release-gate/frontend-staging-withdrawal");
const defaultReportPath = path.join(evidenceRoot, "report.json");
const ACTIONS = new Set(["plan", "full"]);

function parseArgs(argv) {
  const options = { action: "plan", execute: false, report: defaultReportPath };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") {
      options.execute = true;
      continue;
    }
    if (["--action", "--report"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === "--action") options.action = value;
      if (argument === "--report") options.report = path.resolve(repositoryRoot, value);
      continue;
    }
    throw new Error(`Unknown argument ${argument}.`);
  }
  if (!ACTIONS.has(options.action)) throw new Error(`Unsupported action ${options.action}.`);
  if (options.action === "full" && !options.execute) {
    throw new Error("Frontend Staging full drill requires explicit --execute.");
  }
  if (options.action === "plan" && options.execute) {
    throw new Error("Plan mode does not accept --execute.");
  }
  return options;
}

function runCommand(command, args, { cwd = repositoryRoot, env = process.env, capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} exited with status ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function commandOutput(command, args, options = {}) {
  return runCommand(command, args, { ...options, capture: true });
}

function gitValue(args) {
  return commandOutput("git", args).stdout.trim();
}

function ensureCleanTrackedWorkspace() {
  const status = gitValue(["status", "--porcelain", "--untracked-files=no"]);
  if (status) throw new Error("Frontend Staging drill requires a clean tracked workspace.");
}

function writeReport(filename, report) {
  mkdirSync(path.dirname(filename), { recursive: true });
  writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
}

async function fetchCanary() {
  const response = await fetch("https://zhipanda.com/zh/atlas/ri-ri", {
    headers: { "User-Agent": "PandaAtlas-Frontend-Staging-Drill/1.0" },
  });
  const body = await response.text();
  return {
    status: response.status,
    body,
    bodySha256: sha256(body),
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
  };
}

function cleanBuildArtifacts() {
  for (const item of [".next", ".open-next"]) {
    rmSync(path.join(webRoot, item), { recursive: true, force: true });
  }
}

function buildFrontend(mode) {
  cleanBuildArtifacts();
  const env = { ...process.env };
  if (mode === "withdrawn") env.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID = WITHDRAWAL_ID;
  else delete env.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID;
  runCommand(process.execPath, [openNextCli, "build"], { cwd: webRoot, env });
  const output = path.join(webRoot, ".open-next");
  assertDirectory(output, "OpenNext build");
  return treeSha256(output);
}

function deployFrontend(mode) {
  const configPath = mode === "baseline" ? baselineConfigPath : withdrawnConfigPath;
  const result = commandOutput(process.execPath, [
    wranglerCli,
    "deploy",
    "--config",
    configPath,
  ], { cwd: webRoot });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return parseDeploymentOutput(`${result.stdout}\n${result.stderr}`);
}

async function inspectActiveDeployment(expectedVersionId) {
  return runWithBoundedRetry(
    () => {
      const result = commandOutput(process.execPath, [
        wranglerCli,
        "deployments",
        "list",
        "--name",
        STAGING_WORKER_NAME,
        "--config",
        baselineConfigPath,
        "--json",
      ], { cwd: webRoot });
      return parseActiveDeployment(result.stdout, expectedVersionId);
    },
    {
      attempts: 6,
      delayMs: 1000,
      shouldRetry: () => true,
      onRetry(error, attempt, attempts) {
        console.warn(
          `[frontend-staging-retry] active deployment ${expectedVersionId} was not visible on attempt ${attempt}/${attempts}: ${error.message}`,
        );
      },
    },
  );
}

async function runBrowserEvidence({ baseUrl, mode, phase }) {
  const phaseOutput = path.join(evidenceRoot, phase);
  mkdirSync(phaseOutput, { recursive: true });
  await runWithBoundedRetry(
    () => {
      const result = commandOutput(process.execPath, [
        browserScript,
        "--base-url",
        baseUrl,
        "--mode",
        mode,
        "--phase",
        phase,
        "--output",
        phaseOutput,
      ], { cwd: webRoot });
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      return result;
    },
    {
      attempts: 6,
      delayMs: 1500,
      shouldRetry: () => true,
      onRetry(error, attempt, attempts) {
        console.warn(
          `[frontend-staging-retry] browser evidence ${phase} failed on attempt ${attempt}/${attempts}: ${error.message}`,
        );
      },
    },
  );
  return readJson(path.join(phaseOutput, `${phase}-${mode}.json`));
}

function rollbackToBaseline(versionId) {
  const result = commandOutput(process.execPath, [
    wranglerCli,
    "rollback",
    versionId,
    "--name",
    STAGING_WORKER_NAME,
    "--config",
    baselineConfigPath,
    "--message",
    "Issue #85 frontend Staging rollback evidence",
    "--yes",
  ], { cwd: webRoot });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return {
    targetVersionId: versionId,
    outputSha256: sha256(`${result.stdout}\n${result.stderr}`),
  };
}

function buildPlan() {
  return {
    schema_version: 1,
    operation: "frontend-staging-withdrawal-and-rollback",
    outcome: "planned",
    action: "plan",
    commit_sha: gitValue(["rev-parse", "HEAD"]),
    artifact: inspectWithdrawalArtifact(),
    configuration: inspectWebStagingConfigs(),
    sequence: [
      "Production read-only canary",
      "baseline OpenNext build and workers.dev deploy",
      "baseline bilingual/JS/no-JS/keyboard/320px browser evidence",
      "withdrawn OpenNext build and workers.dev deploy",
      "withdrawn 404/no-media-request and unrelated-profile browser evidence",
      "Wrangler rollback to exact baseline Worker Version",
      "restored baseline browser evidence",
      "Production read-only canary and immutable report",
    ],
    production_write_targets: [],
  };
}

async function runFull(reportPath) {
  ensureCleanTrackedWorkspace();
  rmSync(evidenceRoot, { recursive: true, force: true });
  mkdirSync(evidenceRoot, { recursive: true });
  const report = {
    schema_version: 1,
    operation: "frontend-staging-withdrawal-and-rollback",
    outcome: "failed",
    action: "full",
    started_at: new Date().toISOString(),
    commit_sha: gitValue(["rev-parse", "HEAD"]),
    artifact: inspectWithdrawalArtifact(),
    configuration: inspectWebStagingConfigs(),
    steps: [],
  };
  try {
    const productionBefore = await fetchCanary();
    report.steps.push({ id: "production-canary-before", status: "passed", ...productionBefore, body: undefined });

    const baselineBuild = buildFrontend("baseline");
    const baselineDeployment = deployFrontend("baseline");
    const baselineActiveDeployment = await inspectActiveDeployment(baselineDeployment.versionId);
    const baseUrl = validateWebStagingBaseUrl(baselineDeployment.url);
    const baselineBrowser = await runBrowserEvidence({ baseUrl, mode: "baseline", phase: "baseline" });
    report.steps.push({
      id: "baseline",
      status: "passed",
      build: baselineBuild,
      deployment: baselineDeployment,
      activeDeployment: baselineActiveDeployment,
      browserReport: path.relative(repositoryRoot, path.join(evidenceRoot, "baseline/baseline-baseline.json")),
    });

    const withdrawnBuild = buildFrontend("withdrawn");
    const withdrawnDeployment = deployFrontend("withdrawn");
    const withdrawnActiveDeployment = await inspectActiveDeployment(withdrawnDeployment.versionId);
    if (withdrawnDeployment.url !== baseUrl) throw new Error("Withdrawn deployment changed the Staging URL.");
    const withdrawnBrowser = await runBrowserEvidence({ baseUrl, mode: "withdrawn", phase: "withdrawn" });
    report.steps.push({
      id: "withdrawn",
      status: "passed",
      build: withdrawnBuild,
      deployment: withdrawnDeployment,
      activeDeployment: withdrawnActiveDeployment,
      browserReport: path.relative(repositoryRoot, path.join(evidenceRoot, "withdrawn/withdrawn-withdrawn.json")),
    });

    const rollback = rollbackToBaseline(baselineDeployment.versionId);
    const rollbackActiveDeployment = await inspectActiveDeployment(baselineDeployment.versionId);
    const rollbackBrowser = await runBrowserEvidence({ baseUrl, mode: "baseline", phase: "rollback" });
    report.steps.push({
      id: "rollback",
      status: "passed",
      ...rollback,
      activeDeployment: rollbackActiveDeployment,
      browserReport: path.relative(repositoryRoot, path.join(evidenceRoot, "rollback/rollback-baseline.json")),
    });

    validateBrowserEvidence({ baseline: baselineBrowser, withdrawn: withdrawnBrowser, rollback: rollbackBrowser });
    const productionAfter = await fetchCanary();
    validateProductionCanary(productionBefore, productionAfter);
    report.steps.push({ id: "production-canary-after", status: "passed", ...productionAfter, body: undefined });
    report.productionCanary = {
      before: { ...productionBefore, body: undefined },
      after: { ...productionAfter, body: undefined },
    };
    report.baseUrl = baseUrl;
    report.baselineVersionId = baselineDeployment.versionId;
    report.withdrawnVersionId = withdrawnDeployment.versionId;
    report.finalActiveState = "baseline-restored";
    report.outcome = "passed";
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.finished_at = new Date().toISOString();
    writeReport(reportPath, report);
  }
  return report;
}

export async function runFrontendStagingWithdrawal(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.action === "plan") {
    const plan = buildPlan();
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }
  const report = await runFull(options.report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runFrontendStagingWithdrawal().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
