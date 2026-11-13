// Runs on `npm install` / `npm ci` (root `prepare`). Outside a git checkout, such as an unpacked
// release tarball, there is nothing to configure.
import { spawnSync } from "node:child_process";

const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
if (inside.status === 0 && inside.stdout.trim() === "true") {
  spawnSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
}
