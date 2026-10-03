import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../cloudflare.config.ts";

const resolved = config({ mode: "production", isPreview: false });
const env = { ...process.env };
for (const [key, binding] of Object.entries(resolved.worker.env)) {
  // Next's native build uses HTTP; deployed requests use the Worker binding.
  if (binding.type === "text" && key !== "API_TRANSPORT") env[key] = binding.value;
}
const cwd = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const openNextPackageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve("@opennextjs/cloudflare"))),
  "../..",
);
const vitePackageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve("vite"))),
  "../..",
);
const openNextCli = path.join(openNextPackageDir, "dist/cli/index.js");
const viteCli = path.join(vitePackageDir, "bin/vite.js");

function run(command, args) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, [openNextCli, "build", "--skipWranglerConfigCheck"]);
const assets = path.join(cwd, ".cloudflare/assets");
rmSync(assets, { recursive: true, force: true });
cpSync(path.join(cwd, ".open-next/assets"), assets, {
  recursive: true,
  filter: (source) => !source.endsWith(path.join("media", "home-official")),
});
run(process.execPath, [viteCli, "build", "--mode", "production"]);
