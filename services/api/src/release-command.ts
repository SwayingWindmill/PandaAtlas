import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublicationCommandContext } from "./modules/publication/application/publication.application.js";
import {
  type ReleaseReport,
  buildRelease,
  publishRelease,
  renderReleaseReport,
} from "./modules/publication/application/release-command.js";
import { parseReleaseManifest } from "./modules/publication/application/release-manifest.js";
import { createReleaseCommandContext } from "./modules/publication/release-command.module.js";

// Entry point of the release.build and release.publish batch adapters (contracts/batch-operations.v1.json):
//   node services/api/dist/release-command.js build|publish
// The batch runner supplies BATCH_MANIFEST_PATH and BATCH_CHANGE_REFERENCE; the protected workflow job
// supplies DATABASE_URL and DATABASE_SSL_CA_CERT after production-batch approval.

const SYSTEM_KEY = "release-batch-workflow";
const REPORT_DIRECTORY = ".batch-work/release";
const PUBLIC_CHECK_ATTEMPTS = 10;
const PUBLIC_CHECK_INTERVAL_MS = 30_000;

/** A remote database must be reached over verified TLS; only a local test database may skip it. */
function assertVerifiedDatabase(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!local && !process.env.DATABASE_SSL_CA_CERT?.trim()) {
    throw new Error(`DATABASE_SSL_CA_CERT is required to reach ${host} over verified TLS.`);
  }
}

/** The manifest reason plus where the run came from, recorded on every lifecycle transition. */
function provenance(reason: string): string {
  const change = process.env.BATCH_CHANGE_REFERENCE?.trim();
  const run = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
  return [reason, change && `Change: ${change}.`, run && `Run: ${run}.`].filter(Boolean).join(" ").slice(0, 2_000);
}

/** The public API reads the active release through its edge cache, which the API Worker purges on a schedule. */
async function waitForPublicRelease(version: string): Promise<void> {
  const base = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!base) return;
  for (let attempt = 1; attempt <= PUBLIC_CHECK_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${base}/api/v2/release?check=${Date.now()}`).catch(() => undefined);
    const body = response?.ok ? ((await response.json()) as { version?: string }) : undefined;
    if (body?.version === version) {
      console.log(`[release] ${base} serves ${version}.`);
      return;
    }
    console.log(`[release] ${base} still serves ${body?.version ?? "an error"}; checking again (${attempt}/${PUBLIC_CHECK_ATTEMPTS}).`);
    await new Promise((resolve) => setTimeout(resolve, PUBLIC_CHECK_INTERVAL_MS));
  }
  throw new Error(
    `${version} is active in the database, but ${base} does not serve it yet. Check /health/async and the API Worker's scheduled cycle.`,
  );
}

async function writeReport(report: ReleaseReport): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(path.join(REPORT_DIRECTORY, `${report.operation}.json`), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = renderReleaseReport(report);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}

async function main(action: string | undefined): Promise<void> {
  if (action !== "build" && action !== "publish") throw new Error("Usage: release-command.js build|publish");
  const manifestPath = process.env.BATCH_MANIFEST_PATH;
  if (!manifestPath) throw new Error("BATCH_MANIFEST_PATH is required.");
  const manifest = parseReleaseManifest(JSON.parse(await readFile(manifestPath, "utf8")), path.basename(manifestPath));
  assertVerifiedDatabase();

  const { app, ports } = await createReleaseCommandContext();
  try {
    const context: PublicationCommandContext = { actor: { kind: "system", systemKey: SYSTEM_KEY }, correlationId: randomUUID() };
    const report = action === "build"
      ? await buildRelease(ports, manifest, context)
      : await publishRelease(ports, manifest, context, provenance(manifest.reason));
    await writeReport(report);
    if (action === "publish") await waitForPublicRelease(manifest.version);
  } finally {
    await app.close();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(`[release] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
