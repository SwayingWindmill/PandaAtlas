import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const webRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webRoot, "../..");
const policyPath = path.join(repoRoot, "docs/design/zhipanda-frontend-policy.md");

const requiredPolicyMarkers = [
  "吱熊猫 ZhiPanda",
  "https://github.com/Leonxlnx/taste-skill",
  "design-taste-frontend",
  "2026-07-25",
  "https://github.com/pbakaus/impeccable",
  "cli-v2.3.2",
  "b913668",
  "真实性与媒体许可",
];

const publicBrandFiles = [
  "app/layout.tsx",
  "app/[locale]/page.tsx",
  "app/[locale]/pandas/page.tsx",
  "components/patterns/global-navigation.tsx",
  "features/home/editorial-home-page.tsx",
  "features/home/editorial-home-view-model.ts",
  "features/lineage/structured-lineage-page.tsx",
  "features/map/map-provider-registry.ts",
  "features/map/map-view-model.ts",
  "features/my-pandas/my-pandas-view-model.ts",
];

const forbiddenImageHosts = ["picsum.photos", "placehold.co", "placeholder.com"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css"]);
const ignoredDirectories = new Set([".next", ".open-next", "node_modules", "test-results"]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const failures = [];
const policy = await readFile(policyPath, "utf8");
for (const marker of requiredPolicyMarkers) {
  if (!policy.includes(marker)) failures.push(`Design policy is missing required marker: ${marker}`);
}

for (const relativePath of publicBrandFiles) {
  const contents = await readFile(path.join(webRoot, relativePath), "utf8");
  if (contents.includes("PandaAtlas")) {
    failures.push(`${relativePath} still exposes the retired PandaAtlas public brand.`);
  }
}

for (const file of await sourceFiles(webRoot)) {
  if (file === scriptPath) continue;
  const contents = await readFile(file, "utf8");
  for (const host of forbiddenImageHosts) {
    if (contents.includes(host)) failures.push(`${path.relative(webRoot, file)} references ${host}.`);
  }
}

if (failures.length) {
  console.error("ZhiPanda frontend design policy check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ZhiPanda frontend design policy check passed.");
