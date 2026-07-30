import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const defaultReportDir = process.env.RELEASE_GATE_REPORT_DIR
  ? path.resolve(repoRoot, process.env.RELEASE_GATE_REPORT_DIR)
  : path.join(repoRoot, ".release-gate");

const requiredArtifacts = [
  "activity-real-db.xml",
  "engagement-real-db.xml",
  "feed-real-db.xml",
  "notification-real-db.xml",
  "identity-engagement-recovery.json",
  "notification-staging.json",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveCommitSha(commitSha) {
  if (commitSha) return commitSha;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export async function sealPublishedReturnEvidence({
  reportDir = defaultReportDir,
  commitSha,
  generatedAt = new Date().toISOString(),
  platform = process.platform,
} = {}) {
  await mkdir(reportDir, { recursive: true });
  const artifacts = [];
  for (const name of requiredArtifacts) {
    const bytes = await readFile(path.join(reportDir, name));
    if (name.endsWith(".xml")) {
      const text = bytes.toString("utf8");
      if (!text.includes("<testsuite") || /failures="[1-9]/.test(text) || /errors="[1-9]/.test(text)) {
        throw new Error(`Published-return JUnit evidence is not a clean pass: ${name}`);
      }
    }
    if (name.endsWith(".json")) {
      const parsed = JSON.parse(bytes.toString("utf8"));
      const acceptedOutcomes = name === "notification-staging.json"
        ? new Set(["passed", "environment-blocked"])
        : new Set(["passed"]);
      if (!acceptedOutcomes.has(parsed.outcome)) {
        throw new Error(`Published-return recovery evidence did not pass: ${name}`);
      }
    }
    artifacts.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  const manifest = {
    schema_version: 1,
    map_issue: 173,
    closing_issue: 186,
    gate: "published-return-foundation",
    commit_sha: resolveCommitSha(commitSha),
    platform,
    generated_at: generatedAt,
    artifacts,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "published-return-foundation-manifest.json"), manifestBytes);
  await writeFile(
    path.join(reportDir, "published-return-foundation-manifest.sha256"),
    `${sha256(manifestBytes)}  published-return-foundation-manifest.json\n`,
    "utf8",
  );
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  sealPublishedReturnEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
