import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const repoRoot = path.resolve(new URL("../../", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const distDirectory = process.env.PANDA_NEXT_DIST_DIR ?? ".next";
const nextRoot = path.join(repoRoot, "apps", "web", distDirectory);
const manifestPath = path.join(nextRoot, "react-loadable-manifest.json");
const buildIdPath = path.join(nextRoot, "BUILD_ID");
const limitBytes = 180 * 1024;

if (!existsSync(buildIdPath)) {
  console.error(`[map-visualization-budget] ${nextRoot} is not a completed production build`);
  process.exit(1);
}

if (!existsSync(manifestPath)) {
  console.error(`[map-visualization-budget] missing build manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const entry = Object.entries(manifest).find(([key]) => key.includes("map-visualization-island"));
if (!entry) {
  console.error("[map-visualization-budget] dynamic map visualization entry was not found");
  process.exit(1);
}

const [, loadable] = entry;
const javascriptFiles = (loadable.files ?? []).filter((file) => file.endsWith(".js"));
const workerDirectory = path.join(nextRoot, "static", "map");
const workerFiles = existsSync(workerDirectory)
  ? readdirSync(workerDirectory).filter((file) => file.endsWith(".js")).map((file) => `static/map/${file}`)
  : [];
const files = [...javascriptFiles, ...workerFiles];

if (!files.length) {
  console.error("[map-visualization-budget] no JavaScript chunks were found");
  process.exit(1);
}

const measurements = files.map((file) => {
  const absolutePath = path.join(nextRoot, file);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing emitted map asset: ${file}`);
  }
  const bytes = readFileSync(absolutePath);
  return {
    file,
    raw_bytes: bytes.byteLength,
    gzip_bytes: gzipSync(bytes).byteLength,
  };
});
const largest = measurements.reduce((current, measurement) =>
  measurement.gzip_bytes > current.gzip_bytes ? measurement : current,
);
const aggregateGzipBytes = measurements.reduce((total, measurement) => total + measurement.gzip_bytes, 0);
const report = {
  status: largest.gzip_bytes <= limitBytes ? "PASS" : "FAIL",
  limit_bytes: limitBytes,
  largest,
  aggregate_gzip_bytes: aggregateGzipBytes,
  files: measurements,
};

console.log(JSON.stringify(report, null, 2));
if (report.status !== "PASS") process.exit(1);
