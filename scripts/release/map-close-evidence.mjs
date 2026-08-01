import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedWorktreeGitDir() {
  const dotGitPath = path.join(repoRoot, ".git");
  try {
    if (!statSync(dotGitPath).isFile()) return null;
  } catch {
    return null;
  }

  const pointer = readFileSync(dotGitPath, "utf8").trim().match(/^gitdir:\s*(.+)$/i)?.[1];
  if (!pointer) return null;
  const wslPath = process.platform === "win32"
    ? pointer.match(/^\/mnt\/([a-z])\/(.+)$/i)
    : null;
  const normalized = wslPath
    ? `${wslPath[1].toUpperCase()}:\\${wslPath[2].replaceAll("/", "\\")}`
    : pointer;
  return path.isAbsolute(normalized) ? normalized : path.resolve(repoRoot, normalized);
}

function resolveCommitSha(commitSha) {
  if (commitSha) return commitSha;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  const worktreeGitDir = normalizedWorktreeGitDir();
  const args = worktreeGitDir
    ? [`--git-dir=${worktreeGitDir}`, `--work-tree=${repoRoot}`, "rev-parse", "HEAD"]
    : ["rev-parse", "HEAD"];
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
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
