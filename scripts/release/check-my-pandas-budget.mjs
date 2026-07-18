import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "..", "..");
const distDirectory = process.env.PANDA_NEXT_DIST_DIR ?? ".next";
const nextRoot = path.join(repoRoot, "apps", "web", distDirectory);
const manifestPath = path.join(nextRoot, "app-build-manifest.json");
const buildIdPath = path.join(nextRoot, "BUILD_ID");
const firstLoadLimitBytes = 140 * 1024;
const transferLimitBytes = 500 * 1024;

if (!existsSync(buildIdPath)) {
  console.error(`[my-pandas-budget] ${nextRoot} is not a completed production build`);
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(`[my-pandas-budget] missing build manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const routeEntries = ["/layout", "/[locale]/layout", "/[locale]/my-pandas/page"];
const missingEntries = routeEntries.filter((entry) => !manifest.pages?.[entry]);
if (missingEntries.length) {
  console.error(`[my-pandas-budget] missing route entries: ${missingEntries.join(", ")}`);
  process.exit(1);
}

const files = [...new Set(routeEntries.flatMap((entry) => manifest.pages[entry]))]
  .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
  .sort();
const measurements = files.map((file) => {
  const absolutePath = path.join(nextRoot, file);
  if (!existsSync(absolutePath)) throw new Error(`Missing emitted My Pandas asset: ${file}`);
  const bytes = readFileSync(absolutePath);
  return {
    file,
    kind: file.endsWith(".css") ? "css" : "javascript",
    raw_bytes: bytes.byteLength,
    gzip_bytes: gzipSync(bytes).byteLength,
  };
});

const htmlMeasurements = ["en", "zh"].flatMap((locale) => {
  const file = path.join("server", "app", locale, "my-pandas.html");
  const absolutePath = path.join(nextRoot, file);
  if (!existsSync(absolutePath)) return [];
  const bytes = readFileSync(absolutePath);
  return [{ file, kind: "html", raw_bytes: bytes.byteLength, gzip_bytes: gzipSync(bytes).byteLength }];
});
const firstLoadJavaScriptBytes = measurements
  .filter((measurement) => measurement.kind === "javascript")
  .reduce((total, measurement) => total + measurement.gzip_bytes, 0);
const assetTransferBytes = measurements.reduce((total, measurement) => total + measurement.gzip_bytes, 0);
const largestHtmlTransferBytes = htmlMeasurements.reduce(
  (largest, measurement) => Math.max(largest, measurement.gzip_bytes),
  0,
);
const estimatedInitialTransferBytes = assetTransferBytes + largestHtmlTransferBytes;
const report = {
  status: firstLoadJavaScriptBytes <= firstLoadLimitBytes && estimatedInitialTransferBytes <= transferLimitBytes
    ? "PASS"
    : "FAIL",
  first_load_javascript: {
    bytes: firstLoadJavaScriptBytes,
    limit_bytes: firstLoadLimitBytes,
  },
  estimated_initial_transfer: {
    gzip_bytes: estimatedInitialTransferBytes,
    limit_bytes: transferLimitBytes,
    asset_gzip_bytes: assetTransferBytes,
    largest_localized_html_gzip_bytes: largestHtmlTransferBytes,
  },
  files: [...measurements, ...htmlMeasurements],
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exit(1);
