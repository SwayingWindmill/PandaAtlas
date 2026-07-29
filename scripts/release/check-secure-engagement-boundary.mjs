import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const webRoot = path.join(repoRoot, "apps", "web");
const reportDir = process.env.RELEASE_GATE_REPORT_DIR
  ? path.resolve(repoRoot, process.env.RELEASE_GATE_REPORT_DIR)
  : path.join(repoRoot, ".release-gate");

async function walk(directory) {
  const files = [];
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    const details = await stat(absolute);
    if (details.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }
  return files;
}

function relativeWeb(file) {
  return path.relative(webRoot, file).replaceAll("\\", "/");
}

async function checkSourceBoundaries(failures, checks) {
  const preferencePath = path.join(webRoot, "features", "preferences", "profile-preferences.ts");
  const preferences = await readFile(preferencePath, "utf8");
  for (const required of [
    "removeItem(LEGACY_SAVED_PREFERENCE_STORAGE_KEY)",
    "removeItem(LEGACY_SAVED_PROFILES_STORAGE_KEY)",
  ]) {
    if (!preferences.includes(required)) {
      failures.push(`Legacy Saved cleanup is missing ${required}`);
    }
  }
  for (const banned of ["toggleSavedProfile", "TrustedProfileFavorite", "savedPandaIds"]) {
    if (preferences.includes(banned)) failures.push(`Legacy Saved behavior remains: ${banned}`);
  }
  checks.push("legacy-saved-data-cleanup-only");

  const adminLayout = await readFile(path.join(webRoot, "app", "admin", "layout.tsx"), "utf8");
  if (!/robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false/s.test(adminLayout)) {
    failures.push("Admin layout must publish noindex/nofollow metadata");
  }
  const middleware = await readFile(path.join(webRoot, "middleware.ts"), "utf8");
  for (const required of ["Cache-Control", "no-store", "X-Robots-Tag", "noindex"]) {
    if (!middleware.includes(required)) {
      failures.push(`Admin response hardening is missing ${required}`);
    }
  }
  checks.push("admin-noindex-no-cache");

  const browserAreas = ["app", "components", "features", "foundation", "lib"];
  const sourceFiles = [];
  for (const area of browserAreas) {
    sourceFiles.push(...(await walk(path.join(webRoot, area))));
  }
  const writePatterns = [
    /\/rest\/v1\//,
    /\.from\(\s*["'](?:identity|engagement|public)\./,
    /SUPABASE_SERVICE_ROLE_KEY/,
  ];
  for (const file of sourceFiles.filter((item) => /\.(?:ts|tsx|js|mjs)$/.test(item))) {
    const content = await readFile(file, "utf8");
    for (const pattern of writePatterns) {
      if (pattern.test(content)) {
        failures.push(`${relativeWeb(file)} can reach a browser-side business-table write path`);
      }
    }
  }
  checks.push("browser-business-table-writes-denied");
}

async function checkBuiltPublicBundles(failures, checks) {
  const manifestPath = path.join(webRoot, ".next", "app-build-manifest.json");
  if (!existsSync(manifestPath)) {
    failures.push("Production app-build-manifest.json is missing; run the Web build first");
    return { publicEntries: 0, publicChunks: 0 };
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const pages = manifest.pages ?? {};
  const publicEntries = Object.entries(pages).filter(([route]) => !route.includes("/admin"));
  const chunks = new Set(publicEntries.flatMap(([, names]) => names));
  let scanned = 0;
  const forbidden = ["react-admin", "ra-core", "@mui/", "@mui\\/"];
  for (const chunk of [...chunks].sort()) {
    const chunkPath = path.join(webRoot, ".next", chunk);
    if (!existsSync(chunkPath)) continue;
    const content = await readFile(chunkPath, "utf8");
    scanned += 1;
    for (const marker of forbidden) {
      if (content.includes(marker)) {
        failures.push(`Public chunk ${chunk} contains administration runtime marker ${marker}`);
      }
    }
  }
  if (publicEntries.length === 0 || scanned === 0) {
    failures.push("No built public application chunks were available for administration-runtime scan");
  }
  checks.push("public-bundles-exclude-react-admin-and-material-ui");
  return { publicEntries: publicEntries.length, publicChunks: scanned };
}

export async function checkSecureEngagementBoundary() {
  const failures = [];
  const checks = [];
  await checkSourceBoundaries(failures, checks);
  const bundleMetrics = await checkBuiltPublicBundles(failures, checks);
  const report = {
    schema_version: 1,
    gate: "secure-engagement-boundary",
    outcome: failures.length === 0 ? "passed" : "failed",
    checked_at: new Date().toISOString(),
    checks,
    metrics: bundleMetrics,
    failures,
  };
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, "secure-engagement-boundary.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  if (failures.length) {
    throw new Error(`Secure engagement boundary failed:\n- ${failures.join("\n- ")}`);
  }
  console.log(
    `Secure engagement boundary passed: ${bundleMetrics.publicEntries} public entries and ${bundleMetrics.publicChunks} chunks scanned.`,
  );
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkSecureEngagementBoundary().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
