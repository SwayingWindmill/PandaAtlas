import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  CURRENT_MIGRATION,
  CURRENT_RELEASE,
  CURRENT_SCHEMA,
  PRODUCTION_WORKER_NAME,
  STAGING_WORKER_NAME,
  TARGET_MEDIA_ID,
  TARGET_PANDA_ID,
  WITHDRAWAL_ID,
  baselineConfigPath,
  fileSha256,
  inspectWebStagingConfigs,
  inspectWithdrawalArtifact,
  isRetryableFrontendBrowserError,
  parseActiveDeployment,
  parseDeploymentOutput,
  publicReleaseApiPath,
  publicReleaseManifestPath,
  readJson,
  repositoryRoot,
  validateBrowserEvidence,
  validateProductionCanary,
  validateWebStagingBaseUrl,
  validateWebStagingConfigs,
  validateWithdrawalArtifact,
  withdrawalManifestPath,
  withdrawnConfigPath,
} from "../frontend-staging-withdrawal.mjs";

const runnerPath = path.join(repositoryRoot, "scripts/release/run-frontend-staging-withdrawal.mjs");
const publicReleaseSourcePath = path.join(
  repositoryRoot,
  "apps/web/features/public-content/public-release.ts",
);
const runtimeWithdrawalSourcePath = path.join(
  repositoryRoot,
  "apps/web/features/public-content/frontend-withdrawal.ts",
);
const browserEvidenceSourcePath = path.join(
  repositoryRoot,
  "apps/web/scripts/verify-frontend-staging-withdrawal.mjs",
);

function fixtures() {
  return {
    manifest: structuredClone(readJson(withdrawalManifestPath)),
    releaseManifest: structuredClone(readJson(publicReleaseManifestPath)),
    api: structuredClone(readJson(publicReleaseApiPath)),
    releaseManifestSha256: fileSha256(publicReleaseManifestPath),
  };
}

function configs() {
  return {
    baseline: structuredClone(readJson(baselineConfigPath)),
    withdrawn: structuredClone(readJson(withdrawnConfigPath)),
    production: structuredClone(readJson(path.join(repositoryRoot, "apps/web/wrangler.jsonc"))),
  };
}

test("tracked frontend withdrawal is release-bound and ID-bound", () => {
  assert.deepEqual(inspectWithdrawalArtifact(), {
    withdrawalId: WITHDRAWAL_ID,
    release: CURRENT_RELEASE,
    schema: CURRENT_SCHEMA,
    migration: CURRENT_MIGRATION,
    pandaIds: [TARGET_PANDA_ID],
    mediaIds: [TARGET_MEDIA_ID],
    manifestSha256: fileSha256(withdrawalManifestPath),
    publicReleaseManifestSha256: fileSha256(publicReleaseManifestPath),
  });
});

for (const fixture of [
  {
    name: "slug field",
    mutate(value) {
      value.manifest.slug = "ri-ri";
    },
    error: /unsupported field|stable IDs/,
  },
  {
    name: "duplicate panda ID",
    mutate(value) {
      value.manifest.panda_ids.push(TARGET_PANDA_ID);
    },
    error: /panda_ids must contain unique values/,
  },
  {
    name: "unknown panda ID",
    mutate(value) {
      value.manifest.panda_ids = ["00000000-0000-4000-8000-000000000000"];
    },
    error: /unknown panda ID/,
  },
  {
    name: "incomplete media set",
    mutate(value) {
      value.manifest.media_ids = ["media-shin-shin-6b36624de9829665"];
    },
    error: /does not belong|exactly match/,
  },
  {
    name: "release drift",
    mutate(value) {
      value.manifest.dataset_release_version = "2026.07.20.1";
    },
    error: /Withdrawal release/,
  },
  {
    name: "Public Release manifest hash drift",
    mutate(value) {
      value.manifest.public_release_manifest_sha256 = "0".repeat(64);
    },
    error: /not bound to the tracked Public Release manifest SHA-256/,
  },
  {
    name: "unapproved review",
    mutate(value) {
      value.manifest.review_state = "draft";
    },
    error: /must be approved/,
  },
]) {
  test(`frontend withdrawal gate rejects ${fixture.name}`, () => {
    const value = fixtures();
    fixture.mutate(value);
    assert.throws(() => validateWithdrawalArtifact(value), fixture.error);
  });
}

test("baseline and withdrawn Web Staging configs are isolated and differ only by reviewed activation", () => {
  const result = inspectWebStagingConfigs();
  assert.equal(result.workerName, STAGING_WORKER_NAME);
  assert.match(result.baselineConfigSha256, /^[a-f0-9]{64}$/);
  assert.match(result.withdrawnConfigSha256, /^[a-f0-9]{64}$/);
});

for (const fixture of [
  {
    name: "Production Worker name",
    mutate(value) {
      value.withdrawn.name = PRODUCTION_WORKER_NAME;
    },
    error: /must be panda-atlas-web-staging|cannot target Production/,
  },
  {
    name: "custom route",
    mutate(value) {
      value.withdrawn.routes = [{ pattern: "zhipanda.com", custom_domain: true }];
    },
    error: /must not declare custom routes/,
  },
  {
    name: "missing reviewed withdrawal activation",
    mutate(value) {
      delete value.withdrawn.vars.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID;
    },
    error: /must activate the reviewed withdrawal ID/,
  },
  {
    name: "baseline withdrawal activation",
    mutate(value) {
      value.baseline.vars.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID = WITHDRAWAL_ID;
    },
    error: /Baseline config must not activate/,
  },
]) {
  test(`Web Staging config guard rejects ${fixture.name}`, () => {
    const value = configs();
    fixture.mutate(value);
    assert.throws(
      () => validateWebStagingConfigs(value.baseline, value.withdrawn, value.production),
      fixture.error,
    );
  });
}

test("Web Staging URL accepts only the isolated workers.dev host", () => {
  assert.equal(
    validateWebStagingBaseUrl("https://panda-atlas-web-staging.example.workers.dev/"),
    "https://panda-atlas-web-staging.example.workers.dev",
  );
  for (const value of [
    "https://zhipanda.com",
    "https://panda-atlas-web.example.workers.dev",
    "http://panda-atlas-web-staging.example.workers.dev",
    "https://panda-atlas-web-staging.example.workers.dev/zh",
  ]) {
    assert.throws(() => validateWebStagingBaseUrl(value));
  }
});

test("Wrangler deployment identity parser requires URL and immutable Version ID", () => {
  assert.deepEqual(
    parseDeploymentOutput(
      "Uploaded panda-atlas-web-staging\nhttps://panda-atlas-web-staging.example.workers.dev\nVersion ID: 11111111-1111-4111-8111-111111111111\n",
    ),
    {
      url: "https://panda-atlas-web-staging.example.workers.dev",
      versionId: "11111111-1111-4111-8111-111111111111",
    },
  );
  assert.throws(() => parseDeploymentOutput("Uploaded without immutable identity"), /Could not parse/);
});

test("active deployment parser requires one exact Version at 100 percent", () => {
  const versionId = "11111111-1111-4111-8111-111111111111";
  const deployment = {
    id: "22222222-2222-4222-8222-222222222222",
    versions: [{ version_id: versionId, percentage: 100 }],
    created_on: "2026-07-21T00:00:00Z",
  };
  assert.deepEqual(parseActiveDeployment(JSON.stringify([deployment]), versionId), {
    deploymentId: deployment.id,
    versionId,
    percentage: 100,
    createdOn: deployment.created_on,
  });
  assert.throws(
    () => parseActiveDeployment(JSON.stringify([deployment]), "33333333-3333-4333-8333-333333333333"),
    /expected/,
  );
  assert.throws(
    () => parseActiveDeployment(JSON.stringify([{ ...deployment, versions: [{ version_id: versionId, percentage: 50 }] }]), versionId),
    /100 percent/,
  );
});

test("browser retries only transient transport and deployment propagation failures", () => {
  for (const message of [
    "fetch failed",
    "page.goto: Timeout 30000ms exceeded",
    "zh Ri Ri withdrawn profile expected 404; got 200.",
    "net::ERR_CONNECTION_RESET",
  ]) {
    assert.equal(isRetryableFrontendBrowserError(new Error(message)), true, message);
  }
  for (const message of [
    "Executable doesn't exist at chromium_headless_shell.exe",
    "Ri Ri baseline lost reviewed credit.",
    "Withdrawal manifest drifted.",
  ]) {
    assert.equal(isRetryableFrontendBrowserError(new Error(message)), false, message);
  }
});

test("Production canary requires stable release, media, alt, credit, and HTML markers", () => {
  const stable = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: `${CURRENT_RELEASE} ${TARGET_MEDIA_ID} 力力在上野动物园 EleniXDD / Wikimedia Commons`,
    bodySha256: "request-specific-hash",
  };
  assert.doesNotThrow(() => validateProductionCanary(stable, {
    ...structuredClone(stable),
    bodySha256: "another-request-specific-hash",
  }));
  assert.throws(
    () => validateProductionCanary(stable, { ...stable, body: "removed" }),
    /lost stable marker/,
  );
});

test("browser evidence requires baseline, withdrawn, and restored baseline on one host", () => {
  const base = "https://panda-atlas-web-staging.example.workers.dev";
  assert.doesNotThrow(() => validateBrowserEvidence({
    baseline: { mode: "baseline", outcome: "passed", baseUrl: base },
    withdrawn: { mode: "withdrawn", outcome: "passed", baseUrl: base },
    rollback: { mode: "baseline", outcome: "passed", baseUrl: base },
  }));
  assert.throws(() => validateBrowserEvidence({
    baseline: { mode: "baseline", outcome: "passed", baseUrl: base },
    withdrawn: { mode: "withdrawn", outcome: "failed", baseUrl: base },
    rollback: { mode: "baseline", outcome: "passed", baseUrl: base },
  }), /Withdrawn browser evidence failed/);
});

test("full remote drill is rejected before remote access without explicit execute", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--action", "full"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires explicit --execute/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /wrangler|workers\.dev|Deploying/i);
});

test("frontend public content applies the reviewed build-time projection without D1 or client fetching", async () => {
  const [publicReleaseSource, runtimeSource, browserEvidenceSource] = await Promise.all([
    readFile(publicReleaseSourcePath, "utf8"),
    readFile(runtimeWithdrawalSourcePath, "utf8"),
    readFile(browserEvidenceSourcePath, "utf8"),
  ]);
  assert.match(publicReleaseSource, /resolveActiveFrontendWithdrawal\(reviewedDetails\)/);
  assert.match(publicReleaseSource, /applyFrontendWithdrawal\(reviewedDetails, activeWithdrawal\)/);
  assert.match(publicReleaseSource, /!withdrawnPandaIds\.has\(direct\.id\)/);
  assert.match(publicReleaseSource, /publishedLineageNodes/);
  assert.match(publicReleaseSource, /publishedParentageAssertions/);
  assert.match(runtimeSource, /process\.env\.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID/);
  for (const reviewedCopy of [
    "力力在上野动物园",
    "Ri Ri at Ueno Zoo",
    "真真在上野动物园吃竹子",
    "Shin Shin eating bamboo at Ueno Zoo",
    "EleniXDD / Wikimedia Commons",
  ]) {
    assert.match(browserEvidenceSource, new RegExp(reviewedCopy));
  }
  assert.match(browserEvidenceSource, /requests\.every\(\(url\) => !url\.includes\(TARGET_MEDIA_ID\)\)/);
  assert.doesNotMatch(`${publicReleaseSource}\n${runtimeSource}`, /fetch\(|D1|api\.zhipanda\.com/);
});
