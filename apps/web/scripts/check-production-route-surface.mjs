import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");

const forbiddenRouteFiles = [
  "app/[locale]/prototype/panda-fans/page.tsx",
  "app/admin/imports/page.tsx",
  "app/api/admin/import-jobs/route.ts",
  "app/api/admin/import-jobs/[jobId]/route.ts",
  "app/api/admin/import-jobs/[jobId]/run/route.ts",
  "app/api/admin/import-sources/route.ts",
];

const violations = forbiddenRouteFiles
  .filter((relativePath) => existsSync(resolve(webRoot, relativePath)))
  .map((relativePath) => `forbidden production route exists: ${relativePath}`);

const globalsPath = resolve(webRoot, "app/globals.css");
const globals = readFileSync(globalsPath, "utf8");
for (const prototypeStylesheet of [
  "panda-fan-prototype.css",
  "panda-fan-brand-story-prototype.css",
]) {
  if (globals.includes(prototypeStylesheet)) {
    violations.push(`prototype stylesheet is imported globally: ${prototypeStylesheet}`);
  }
}

if (violations.length > 0) {
  console.error("ZhiPanda production route surface check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("ZhiPanda production route surface check passed.");
