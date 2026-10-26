import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const webRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(webRoot, "../..");
const policyPath = path.join(repoRoot, "docs/design/zhipanda-frontend-policy.md");
const designSystemPath = path.join(repoRoot, "docs/design/zhipanda-design-system.md");

const requiredPolicyMarkers = [
  "吱熊猫 ZhiPanda",
  "zhipanda-design-system.md",
  "真实性与媒体许可",
];

const requiredDesignSystemMarkers = [
  "十条规则",
  "@radix-ui/colors",
  "apps/web/styles/tokens.css",
];

const publicBrandFiles = [
  "app/layout.tsx",
  "app/[locale]/page.tsx",
  "app/[locale]/pandas/page.tsx",
  "app/[locale]/layout.tsx",
  "components/navbar-1.tsx",
  "components/command-menu-04.tsx",
  "components/blocks/marketing/footers/minimal.tsx",
  "features/home/home-page.tsx",
  "features/home/home-v09-view-model.ts",
  "features/lineage/structured-lineage-page.tsx",
  "features/my-pandas/my-pandas-view-model.ts",
];

const forbiddenImageHosts = ["picsum.photos", "placehold.co", "placeholder.com"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css"]);
const ignoredDirectories = new Set([".next", ".cloudflare", "node_modules", "test-results"]);

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
const designSystem = await readFile(designSystemPath, "utf8");
for (const marker of requiredDesignSystemMarkers) {
  if (!designSystem.includes(marker)) failures.push(`Design system is missing required marker: ${marker}`);
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
