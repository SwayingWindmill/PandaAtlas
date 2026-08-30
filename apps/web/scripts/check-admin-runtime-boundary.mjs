import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const require = createRequire(import.meta.url);

function readPackageVersion(packageName) {
  const entry = require.resolve(packageName);
  let directory = path.dirname(entry);
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, "package.json");
    try {
      const payload = JSON.parse(readFileSync(candidate, "utf8"));
      if (payload.name === packageName) return payload.version;
    } catch {
      // Continue toward the package root.
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Could not locate package.json for ${packageName}`);
}

const expectedVersions = new Map([
  ["react-admin", "5.15.1"],
  ["react-router", "7.18.3"],
  ["react-router-dom", "7.18.3"],
]);

const failures = [];
for (const [packageName, expected] of expectedVersions) {
  const actual = readPackageVersion(packageName);
  if (actual !== expected) {
    failures.push(`${packageName} must remain pinned to ${expected}; found ${actual}`);
  }
}

const shellPath = path.join(webRoot, "components", "admin", "react-admin-shell.tsx");
const loaderPath = path.join(webRoot, "components", "admin", "admin-shell-loader.tsx");
const shell = readFileSync(shellPath, "utf8");
const loader = readFileSync(loaderPath, "utf8");

if (!shell.startsWith('"use client";')) {
  failures.push("React-admin shell must be a client component");
}
if (!loader.startsWith('"use client";') || !loader.includes("ssr: false")) {
  failures.push("React-admin must be dynamically loaded with SSR disabled");
}
for (const banned of [
  '"use server"',
  "createBrowserRouter",
  "RouterProvider",
  "react-router-dom/server",
  "react-server-dom",
]) {
  if (shell.includes(banned) || loader.includes(banned)) {
    failures.push(`React-admin boundary must not use ${banned}`);
  }
}

function walk(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolute = path.join(directory, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) entries.push(...walk(absolute));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(name)) entries.push(absolute);
  }
  return entries;
}

const allowedReactAdminFile = path.normalize(shellPath);
for (const area of ["app", "components", "features", "foundation", "lib"]) {
  for (const file of walk(path.join(webRoot, area))) {
    const content = readFileSync(file, "utf8");
    if (
      path.normalize(file) !== allowedReactAdminFile &&
      /(?:from\s+["']react-admin["']|from\s+["']ra-|from\s+["']@mui\/)/.test(content)
    ) {
      failures.push(
        `${path.relative(webRoot, file)} imports the administration runtime outside its isolated shell`,
      );
    }
  }
}

if (failures.length) {
  console.error("Admin runtime boundary check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Admin runtime boundary passed: client-only dynamic shell, pinned router exception, and no public imports.",
);
