import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  isRetryableFrontendBrowserError,
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
const statePath = path.join(evidenceRoot, "state.json");
const defaultReportPath = path.join(evidenceRoot, "report.json");
const ACTIONS = new Set(["plan", "baseline", "withdrawn", "rollback", "full"]);

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
  if (options.action !== "plan" && !options.execute) {
    throw new Error(`Frontend Staging ${options.action} requires explicit --execute.`);
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
      shouldRetry: isRetryableFrontendBrowserError,
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

function currentIdentity() {
  return {
    commit_sha: gitValue(["rev-parse", "HEAD"]),
    artifact: inspectWithdrawalArtifact(),
    configuration: inspectWebStagingConfigs(),
  };
}

function loadStageState() {
  if (!existsSync(statePath)) {
    throw new Error("Frontend Staging state is missing; run the baseline stage first.");
  }
  const state = readJson(statePath);
  const identity = currentIdentity();
  if (state.commit_sha !== identity.commit_sha) {
    throw new Error(`Frontend Staging state belongs to ${state.commit_sha}; current commit is ${identity.commit_sha}.`);
  }
  if (JSON.stringify(state.artifact) !== JSON.stringify(identity.artifact)) {
    throw new Error("Frontend Staging state artifact identity drifted.");
  }
  if (JSON.stringify(state.configuration) !== JSON.stringify(identity.configuration)) {
    throw new Error("Frontend Staging state configuration identity drifted.");
  }
  return state;
}

function canaryStep(id, canary) {
  return {
    id,
    status: "passed",
    httpStatus: canary.status,
    bodySha256: canary.bodySha256,
    contentType: canary.contentType,
    cacheControl: canary.cacheControl,
  };
}

function stageSummary(state, action) {
  return {
    schema_version: state.schema_version,
    operation: state.operation,
    outcome: state[action]?.status === "passed" ? "passed" : "in-progress",
    action,
    commit_sha: state.commit_sha,
    artifact: state.artifact,
    configuration: state.configuration,
    baseUrl: state.baseUrl,
    step: state[action],
  };
}

async function runBaselineStage() {
  ensureCleanTrackedWorkspace();
  rmSync(evidenceRoot, { recursive: true, force: true });
  mkdirSync(evidenceRoot, { recursive: true });
  const state = {
    schema_version: 1,
    operation: "frontend-staging-withdrawal-and-rollback",
    outcome: "in-progress",
    started_at: new Date().toISOString(),
    ...currentIdentity(),
  };
  try {
    state.productionBefore = await fetchCanary();
    const build = buildFrontend("baseline");
    const deployment = deployFrontend("baseline");
    const activeDeployment = await inspectActiveDeployment(deployment.versionId);
    const baseUrl = validateWebStagingBaseUrl(deployment.url);
    state.baseUrl = baseUrl;
    state.baseline = { status: "deployed", build, deployment, activeDeployment };
    writeReport(statePath, state);
    const browser = await runBrowserEvidence({ baseUrl, mode: "baseline", phase: "baseline" });
    state.baseline.status = "passed";
    state.baseline.browserReport = path.relative(
      repositoryRoot,
      path.join(evidenceRoot, "baseline/baseline-baseline.json"),
    );
    state.baseline.browserOutcome = browser.outcome;
    delete state.error;
    writeReport(statePath, state);
    return stageSummary(state, "baseline");
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    writeReport(statePath, state);
    throw error;
  }
}

async function runWithdrawnStage() {
  ensureCleanTrackedWorkspace();
  const state = loadStageState();
  if (state.baseline?.status !== "passed") {
    throw new Error("Frontend Staging baseline stage has not passed.");
  }
  try {
    const build = buildFrontend("withdrawn");
    const deployment = deployFrontend("withdrawn");
    const activeDeployment = await inspectActiveDeployment(deployment.versionId);
    if (deployment.url !== state.baseUrl) throw new Error("Withdrawn deployment changed the Staging URL.");
    state.withdrawn = { status: "deployed", build, deployment, activeDeployment };
    writeReport(statePath, state);
    const browser = await runBrowserEvidence({
      baseUrl: state.baseUrl,
      mode: "withdrawn",
      phase: "withdrawn",
    });
    state.withdrawn.status = "passed";
    state.withdrawn.browserReport = path.relative(
      repositoryRoot,
      path.join(evidenceRoot, "withdrawn/withdrawn-withdrawn.json"),
    );
    state.withdrawn.browserOutcome = browser.outcome;
    delete state.error;
    writeReport(statePath, state);
    return stageSummary(state, "withdrawn");
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    writeReport(statePath, state);
    throw error;
  }
}

async function runRollbackStage(reportPath) {
  ensureCleanTrackedWorkspace();
  const state = loadStageState();
  if (!state.baseline?.deployment?.versionId) {
    throw new Error("Frontend Staging baseline Version ID is missing.");
  }
  try {
    const rollback = rollbackToBaseline(state.baseline.deployment.versionId);
    const activeDeployment = await inspectActiveDeployment(state.baseline.deployment.versionId);
    state.rollback = { status: "deployed", ...rollback, activeDeployment };
    writeReport(statePath, state);
    const rollbackBrowser = await runBrowserEvidence({
      baseUrl: state.baseUrl,
      mode: "baseline",
      phase: "rollback",
    });
    state.rollback.status = "passed";
    state.rollback.browserReport = path.relative(
      repositoryRoot,
      path.join(evidenceRoot, "rollback/rollback-baseline.json"),
    );
    state.rollback.browserOutcome = rollbackBrowser.outcome;

    if (state.baseline.status !== "passed" || state.withdrawn?.status !== "passed") {
      throw new Error("Baseline was restored, but the baseline or withdrawn evidence stage did not pass.");
    }
    const baselineBrowser = readJson(path.join(repositoryRoot, state.baseline.browserReport));
    const withdrawnBrowser = readJson(path.join(repositoryRoot, state.withdrawn.browserReport));
    validateBrowserEvidence({
      baseline: baselineBrowser,
      withdrawn: withdrawnBrowser,
      rollback: rollbackBrowser,
    });
    const productionAfter = await fetchCanary();
    validateProductionCanary(state.productionBefore, productionAfter);
    state.productionAfter = productionAfter;
    state.outcome = "passed";
    state.finished_at = new Date().toISOString();
    state.finalActiveState = "baseline-restored";
    delete state.error;
    writeReport(statePath, state);

    const report = {
      schema_version: state.schema_version,
      operation: state.operation,
      outcome: state.outcome,
      action: "rollback",
      started_at: state.started_at,
      finished_at: state.finished_at,
      commit_sha: state.commit_sha,
      artifact: state.artifact,
      configuration: state.configuration,
      baseUrl: state.baseUrl,
      baselineVersionId: state.baseline.deployment.versionId,
      withdrawnVersionId: state.withdrawn.deployment.versionId,
      finalActiveState: state.finalActiveState,
      steps: [
        canaryStep("production-canary-before", state.productionBefore),
        { id: "baseline", ...state.baseline },
        { id: "withdrawn", ...state.withdrawn },
        { id: "rollback", ...state.rollback },
        canaryStep("production-canary-after", state.productionAfter),
      ],
      productionCanary: {
        before: { ...state.productionBefore, body: undefined },
        after: { ...state.productionAfter, body: undefined },
      },
    };
    writeReport(reportPath, report);
    return report;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    state.finished_at = new Date().toISOString();
    writeReport(statePath, state);
    throw error;
  }
}

async function runFull(reportPath) {
  const scriptPath = fileURLToPath(import.meta.url);
  for (const action of ["baseline", "withdrawn", "rollback"]) {
    const args = [scriptPath, "--action", action, "--execute"];
    if (action === "rollback") args.push("--report", reportPath);
    runCommand(process.execPath, args);
  }
  return readJson(reportPath);
}

export async function runFrontendStagingWithdrawal(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.action === "plan") {
    const plan = buildPlan();
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }
  const result = options.action === "baseline"
    ? await runBaselineStage()
    : options.action === "withdrawn"
      ? await runWithdrawnStage()
      : options.action === "rollback"
        ? await runRollbackStage(options.report)
        : await runFull(options.report);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runFrontendStagingWithdrawal().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
