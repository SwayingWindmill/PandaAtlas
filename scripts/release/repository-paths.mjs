import { spawnSync } from "node:child_process";

function gitLsFiles(cwd, args) {
  const result = spawnSync("git", ["ls-files", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`Unable to inspect repository paths: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `git ls-files failed with code ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }

  return String(result.stdout ?? "").split("\0").filter(Boolean);
}

// Repository checks judge the working tree by the repository's own tracked .gitignore files.
// Local excludes (core.excludesFile, .git/info/exclude) must not hide files from them.
export function listRepositoryPaths({ cwd, pathspecs = [] }) {
  return gitLsFiles(cwd, [
    "--cached",
    "--others",
    "--exclude-per-directory=.gitignore",
    "-z",
    ...(pathspecs.length > 0 ? ["--", ...pathspecs] : []),
  ]);
}

// Committed files only, as CI sees them.
export function listTrackedPaths({ cwd }) {
  return gitLsFiles(cwd, ["--cached", "-z"]);
}
