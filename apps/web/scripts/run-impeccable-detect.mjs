import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../..");
const launcher = path.join(
  repoRoot,
  ".agents",
  "skills",
  "impeccable",
  "scripts",
  process.platform === "win32" ? "impeccable.cmd" : "impeccable",
);

const result = spawnSync(launcher, ["detect", ...process.argv.slice(2)], {
  cwd: path.resolve(repoRoot, "apps/web"),
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
