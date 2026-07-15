import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function requiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return value;
}

function compactFinding(finding) {
  return {
    id: finding.id,
    impact: finding.impact,
    help: finding.help,
    helpUrl: finding.helpUrl,
    nodes: finding.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  };
}

function collectAxeScans(node, context = {}, scans = []) {
  if (!node || typeof node !== "object") return scans;

  const nextContext = Array.isArray(node.tests) && typeof node.title === "string"
    ? { ...context, testTitle: node.title }
    : context;

  if (Array.isArray(node.attachments)) {
    for (const attachment of node.attachments) {
      if (attachment.name !== "axe-desktop-initial"
        && attachment.name !== "axe-mobile-initial"
        && !attachment.name?.startsWith("axe-keyboard-")
        && attachment.name !== "axe-mobile-distribution-controls-open") continue;

      const axe = JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
      scans.push({
        testTitle: nextContext.testTitle,
        state: attachment.name,
        url: axe.url,
        timestamp: axe.timestamp,
        toolOptions: axe.toolOptions,
        testEngine: axe.testEngine,
        testRunner: axe.testRunner,
        testEnvironment: axe.testEnvironment,
        violations: axe.violations.map(compactFinding),
        incomplete: axe.incomplete.map(compactFinding),
      });
    }
  }

  for (const value of Object.values(node)) collectAxeScans(value, nextContext, scans);
  return scans;
}

const input = path.resolve(requiredArgument("--input"));
const output = path.resolve(requiredArgument("--output"));
const source = JSON.parse(await readFile(input, "utf8"));
const scans = collectAxeScans(source);

if (scans.length === 0) throw new Error("No axe attachments found in the Playwright report");

const evidence = {
  schemaVersion: 1,
  deploymentUrl: requiredArgument("--deployment-url"),
  cloudflareWorkerVersion: requiredArgument("--worker-version"),
  gitCommit: requiredArgument("--git-commit"),
  sourceReport: path.basename(input),
  scanCount: scans.length,
  violationCount: scans.reduce((total, scan) => total + scan.violations.length, 0),
  incompleteCount: scans.reduce((total, scan) => total + scan.incomplete.length, 0),
  scans,
};

await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`ACCESSIBILITY_EVIDENCE_SUMMARY scans=${evidence.scanCount} violations=${evidence.violationCount} incomplete=${evidence.incompleteCount} output=${output}`);
