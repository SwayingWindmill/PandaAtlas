import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const defaultNextRoot = path.join(
  repoRoot,
  "apps",
  "web",
  process.env.PANDA_NEXT_DIST_DIR ?? ".next",
);
const defaultReportPath = path.join(
  process.env.RELEASE_GATE_REPORT_DIR
    ? path.resolve(repoRoot, process.env.RELEASE_GATE_REPORT_DIR)
    : path.join(repoRoot, ".release-gate"),
  "admin-bundle-budget.json",
);

export const adminBundleGzipLimitBytes = 768 * 1024;

export function measureAdminBundle({
  nextRoot = defaultNextRoot,
  limitBytes = adminBundleGzipLimitBytes,
} = {}) {
  const buildIdPath = path.join(nextRoot, "BUILD_ID");
  const manifestPath = path.join(nextRoot, "react-loadable-manifest.json");
  if (!existsSync(buildIdPath)) {
    throw new Error(`[admin-bundle-budget] ${nextRoot} is not a completed production build`);
  }
  if (!existsSync(manifestPath)) {
    throw new Error(`[admin-bundle-budget] missing build manifest: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entries = Object.entries(manifest).filter(([key]) =>
    key.includes("react-admin-shell"),
  );
  if (entries.length === 0) {
    throw new Error("[admin-bundle-budget] isolated React-admin dynamic entry was not found");
  }

  const files = [
    ...new Set(
      entries.flatMap(([, entry]) =>
        (entry.files ?? []).filter((file) => file.endsWith(".js")),
      ),
    ),
  ].sort();
  if (files.length === 0) {
    throw new Error("[admin-bundle-budget] no JavaScript chunks were found");
  }

  const measurements = files.map((file) => {
    const absolutePath = path.join(nextRoot, file);
    if (!existsSync(absolutePath)) {
      throw new Error(`[admin-bundle-budget] missing emitted admin asset: ${file}`);
    }
    const bytes = readFileSync(absolutePath);
    return {
      file,
      raw_bytes: bytes.byteLength,
      gzip_bytes: gzipSync(bytes).byteLength,
    };
  });
  const aggregateGzipBytes = measurements.reduce(
    (total, measurement) => total + measurement.gzip_bytes,
    0,
  );
  return {
    status: aggregateGzipBytes <= limitBytes ? "PASS" : "FAIL",
    limit_bytes: limitBytes,
    aggregate_gzip_bytes: aggregateGzipBytes,
    files: measurements,
  };
}

export function writeAdminBundleBudgetReport({
  nextRoot = defaultNextRoot,
  reportPath = defaultReportPath,
  limitBytes = adminBundleGzipLimitBytes,
} = {}) {
  const report = measureAdminBundle({ nextRoot, limitBytes });
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const report = writeAdminBundleBudgetReport();
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
