import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..", "..");
const distDirectory = process.env.PANDA_NEXT_DIST_DIR ?? ".next";
const nextRoot = path.join(repoRoot, "apps", "web", distDirectory);
const buildIdPath = path.join(nextRoot, "BUILD_ID");
const manifestPath = path.join(nextRoot, "app-build-manifest.json");
const inventoryPath = path.join(repoRoot, "data", "frontend-system", "route-performance-budgets.json");

if (!existsSync(buildIdPath)) {
  console.error(`[route-budgets] ${nextRoot} is not a completed production build`);
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(`[route-budgets] missing build manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const sharedEntries = ["/layout", "/[locale]/layout"];
const results = [];
let failed = false;

for (const surface of inventory.surfaces) {
  const routeEntries = [...sharedEntries, surface.manifest_entry];
  const missingEntries = routeEntries.filter((entry) => !manifest.pages?.[entry]);
  if (missingEntries.length) {
    results.push({ id: surface.id, status: "FAIL", missing_entries: missingEntries });
    failed = true;
    continue;
  }

  const files = [...new Set(routeEntries.flatMap((entry) => manifest.pages[entry]))]
    .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
    .sort();
  const measurements = files.map((file) => {
    const absolutePath = path.join(nextRoot, file);
    if (!existsSync(absolutePath)) throw new Error(`Missing emitted route asset: ${file}`);
    const bytes = readFileSync(absolutePath);
    return {
      file,
      kind: file.endsWith(".css") ? "css" : "javascript",
      gzip_bytes: gzipSync(bytes).byteLength,
    };
  });
  const htmlMeasurements = surface.html_paths.flatMap((file) => {
    const absolutePath = path.join(nextRoot, file);
    if (!existsSync(absolutePath)) return [];
    const bytes = readFileSync(absolutePath);
    return [{ file, kind: "html", gzip_bytes: gzipSync(bytes).byteLength }];
  });
  const firstLoadJavaScript = measurements
    .filter((item) => item.kind === "javascript")
    .reduce((total, item) => total + item.gzip_bytes, 0);
  const assetTransfer = measurements.reduce((total, item) => total + item.gzip_bytes, 0);
  const largestHtml = htmlMeasurements.reduce((largest, item) => Math.max(largest, item.gzip_bytes), 0);
  const estimatedInitialTransfer = assetTransfer + largestHtml;
  const firstLoadLimit = surface.first_load_javascript_gzip_limit_bytes
    ?? inventory.defaults.first_load_javascript_gzip_limit_bytes;
  const transferLimit = surface.initial_static_transfer_gzip_limit_bytes
    ?? inventory.defaults.initial_static_transfer_gzip_limit_bytes;
  const status = firstLoadJavaScript <= firstLoadLimit && estimatedInitialTransfer <= transferLimit
    ? "PASS"
    : "FAIL";
  if (status === "FAIL") failed = true;
  results.push({
    id: surface.id,
    status,
    manifest_entry: surface.manifest_entry,
    first_load_javascript: { gzip_bytes: firstLoadJavaScript, limit_bytes: firstLoadLimit },
    estimated_initial_transfer: {
      gzip_bytes: estimatedInitialTransfer,
      limit_bytes: transferLimit,
      asset_gzip_bytes: assetTransfer,
      largest_html_gzip_bytes: largestHtml,
    },
    files: [...measurements, ...htmlMeasurements],
  });
}

console.log(JSON.stringify({ status: failed ? "FAIL" : "PASS", routes: results }, null, 2));
if (failed) process.exit(1);
