import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveCommitSha(commitSha) {
  if (commitSha) return commitSha;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function isSealableArtifact(name) {
  return (
    (name.endsWith(".json") || name.endsWith(".yaml") || name.endsWith(".sha256")) &&
    name !== "map-close-manifest.json" &&
    name !== "map-close-manifest.sha256"
  );
}

export async function sealMapCloseEvidence({
  reportDir,
  commitSha,
  generatedAt = new Date().toISOString(),
  platform = process.platform,
} = {}) {
  if (!reportDir) throw new TypeError("sealMapCloseEvidence requires reportDir");
  await mkdir(reportDir, { recursive: true });

  const names = (await readdir(reportDir)).filter(isSealableArtifact).sort();
  if (!names.includes("default.json") || !names.includes("map-close.json")) {
    throw new Error("Map-close evidence requires default.json and map-close.json");
  }

  const artifacts = [];
  for (const name of names) {
    const bytes = await readFile(path.join(reportDir, name));
    artifacts.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }

  const manifest = {
    schema_version: 1,
    release_gate: "map-close",
    commit_sha: resolveCommitSha(commitSha),
    platform,
    generated_at: generatedAt,
    artifacts,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(reportDir, "map-close-manifest.json"), manifestBytes);
  await writeFile(
    path.join(reportDir, "map-close-manifest.sha256"),
    `${sha256(manifestBytes)}  map-close-manifest.json\n`,
    "utf8",
  );
  return manifest;
}
