import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const failures = [];

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

const retiredAdminRuntimeImport = /(?:from\s+["']react-admin["']|from\s+["']ra-|from\s+["']@mui\/)/;

for (const area of ["app", "components", "features", "foundation", "lib"]) {
  for (const file of walk(path.join(webRoot, area))) {
    const content = readFileSync(file, "utf8");
    if (retiredAdminRuntimeImport.test(content)) {
      failures.push(`${path.relative(webRoot, file)} imports the retired React Admin runtime`);
    }
  }
}

if (failures.length) {
  console.error("Admin runtime boundary check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin runtime boundary passed: retired React Admin and MUI imports are absent.");
