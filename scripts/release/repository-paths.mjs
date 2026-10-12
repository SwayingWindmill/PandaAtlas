import { spawnSync } from "node:child_process";

// Repository checks judge the working tree by the repository's own tracked .gitignore files.
// Local excludes (core.excludesFile, .git/info/exclude) must not hide files from them.
export function listRepositoryPaths({ cwd, pathspecs = [] }) {
  const result = spawnSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-per-directory=.gitignore",
      "-z",
      ...(pathspecs.length > 0 ? ["--", ...pathspecs] : []),
    ],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    },
  );

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
