import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const STATUS_ORDER = ["passed", "failed", "skipped", "environment-blocked"];

export class EnvironmentBlockedError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "EnvironmentBlockedError";
  }
}

export class ReleaseGateError extends Error {
  constructor(report) {
    super(`Release gate ${report.gate} finished with outcome ${report.outcome}`);
    this.name = "ReleaseGateError";
    this.report = report;
  }
}

function errorDetail(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function markdownCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function createCounts(steps) {
  return {
    passed: steps.filter((step) => step.status === "passed").length,
    failed: steps.filter((step) => step.status === "failed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    environment_blocked: steps.filter((step) => step.status === "environment-blocked").length,
  };
}

function reportOutcome(counts) {
  if (counts.failed > 0) {
    return "failed";
  }
  if (counts.environment_blocked > 0) {
    return "environment-blocked";
  }
  return "passed";
}

export function renderMarkdownReport(report) {
  const lines = [
    `# Release gate: ${report.gate}`,
    "",
    `- Outcome: **${report.outcome}**`,
    `- Platform: \`${report.platform}\``,
    `- Node: \`${report.node_version}\``,
    `- Started: ${report.started_at}`,
    `- Finished: ${report.finished_at}`,
    "",
    "| Status | Count |",
    "| --- | ---: |",
  ];

  for (const status of STATUS_ORDER) {
    const countKey = status === "environment-blocked" ? "environment_blocked" : status;
    lines.push(`| ${status} | ${report.counts[countKey]} |`);
  }

  lines.push("", "| Step | Status | Detail | Duration (ms) |", "| --- | --- | --- | ---: |");
  for (const step of report.steps) {
    lines.push(
      `| ${markdownCell(step.label)} | ${step.status} | ${markdownCell(step.detail)} | ${step.duration_ms} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function writeReport(report, reportDir) {
  await mkdir(reportDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(reportDir, `${report.gate}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(path.join(reportDir, `${report.gate}.md`), renderMarkdownReport(report), "utf8"),
  ]);
}

function logStep(step, logger) {
  const detail = step.detail ? ` — ${step.detail}` : "";
  logger.log(`[release-gate] ${step.status.padEnd(19)} ${step.label}${detail}`);
}

export async function runReleaseGate({
  gate,
  steps,
  reportDir,
  platform = process.platform,
  nodeVersion = process.version,
  now = () => new Date(),
  throwOnFailure = true,
  logger = console,
}) {
  if (!gate || !Array.isArray(steps) || !reportDir) {
    throw new TypeError("runReleaseGate requires gate, steps, and reportDir");
  }

  const startedAt = now();
  const results = [];
  const resultsById = new Map();

  for (const step of steps) {
    const stepStartedAt = now();
    let status = "passed";
    let detail = "";

    const blockedDependency = (step.dependsOn ?? []).find(
      (dependencyId) => resultsById.get(dependencyId)?.status !== "passed",
    );

    if (step.skipReason) {
      status = "skipped";
      detail = step.skipReason;
    } else if (blockedDependency) {
      status = "skipped";
      const dependencyStatus = resultsById.get(blockedDependency)?.status ?? "missing";
      detail = `Dependency ${blockedDependency} did not pass (${dependencyStatus})`;
    } else if (typeof step.run !== "function") {
      status = "failed";
      detail = "Step has no run function";
    } else {
      try {
        await step.run({ results: [...results] });
      } catch (error) {
        status = error instanceof EnvironmentBlockedError ? "environment-blocked" : "failed";
        detail = errorDetail(error);
      }
    }

    const durationMs = Math.max(0, now().getTime() - stepStartedAt.getTime());
    const result = {
      id: step.id,
      label: step.label,
      status,
      detail,
      duration_ms: durationMs,
    };
    results.push(result);
    resultsById.set(step.id, result);
    logStep(result, logger);
  }

  const counts = createCounts(results);
  const report = {
    schema_version: 1,
    gate,
    outcome: reportOutcome(counts),
    platform,
    node_version: nodeVersion,
    started_at: startedAt.toISOString(),
    finished_at: now().toISOString(),
    counts,
    steps: results,
  };

  await writeReport(report, reportDir);
  logger.log(
    `[release-gate] outcome=${report.outcome} passed=${counts.passed} failed=${counts.failed} skipped=${counts.skipped} environment-blocked=${counts.environment_blocked}`,
  );

  if (throwOnFailure && report.outcome !== "passed") {
    throw new ReleaseGateError(report);
  }
  return report;
}
