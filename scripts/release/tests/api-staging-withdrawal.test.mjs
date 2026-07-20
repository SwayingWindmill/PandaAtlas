import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  BASELINE_RELEASE,
  CURRENT_RELEASE,
  PLACEHOLDER_DATABASE_ID,
  PRODUCTION_DATABASE_ID,
  PRODUCTION_DATABASE_NAME,
  PRODUCTION_MEDIA_BUCKET,
  STAGING_DATABASE_NAME,
  STAGING_GEO_BUCKET,
  STAGING_MEDIA_BUCKET,
  STAGING_WORKER_NAME,
  assertBaselineHttpEvidence,
  assertEntityWithdrawalHttpEvidence,
  assertProductionCanaryEvidence,
  assertWholeReleaseHttpEvidence,
  buildBaselineVerificationSql,
  buildEntityWithdrawalSql,
  buildEntityWithdrawalVerificationSql,
  buildStagingReleaseResetSql,
  buildWholeReleaseVerificationSql,
  buildWholeReleaseWithdrawalSql,
  isRetryableCloudflareError,
  readStagingConfig,
  reviewedMediaObjects,
  runWithBoundedRetry,
  validateBaselineVerification,
  validateEntityWithdrawalVerification,
  validateStagingBaseUrl,
  validateStagingConfig,
  validateWholeReleaseVerification,
} from "../api-staging-withdrawal.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const runnerPath = path.join(repoRoot, "scripts/release/run-api-staging-withdrawal.mjs");
const validDatabaseId = "11111111-1111-4111-8111-111111111111";

function validConfig() {
  return {
    name: STAGING_WORKER_NAME,
    main: "src/index.ts",
    compatibility_date: "2026-05-01",
    workers_dev: true,
    routes: [],
    vars: { APP_ENV: "staging" },
    d1_databases: [
      {
        binding: "DB",
        database_name: STAGING_DATABASE_NAME,
        database_id: validDatabaseId,
      },
    ],
    r2_buckets: [
      { binding: "GEO_BUCKET", bucket_name: STAGING_GEO_BUCKET },
      { binding: "MEDIA_BUCKET", bucket_name: STAGING_MEDIA_BUCKET },
    ],
  };
}

test("bounded retry recovers from transient Cloudflare transport failures", async () => {
  let calls = 0;
  const retries = [];
  const result = await runWithBoundedRetry(
    () => {
      calls += 1;
      if (calls < 3) throw new Error("fetch failed");
      return "passed";
    },
    {
      attempts: 4,
      delayMs: 10,
      sleep: async () => {},
      onRetry(_error, attempt) {
        retries.push(attempt);
      },
    },
  );
  assert.equal(result, "passed");
  assert.equal(calls, 3);
  assert.deepEqual(retries, [1, 2]);
});

test("bounded retry fails immediately for non-transport errors", async () => {
  let calls = 0;
  await assert.rejects(
    runWithBoundedRetry(
      () => {
        calls += 1;
        throw new Error("manifest mismatch");
      },
      { attempts: 5, delayMs: 0, sleep: async () => {} },
    ),
    /manifest mismatch/,
  );
  assert.equal(calls, 1);
});

test("bounded retry stops after the configured maximum", async () => {
  let calls = 0;
  await assert.rejects(
    runWithBoundedRetry(
      () => {
        calls += 1;
        throw new Error("UND_ERR_CONNECT_TIMEOUT");
      },
      { attempts: 3, delayMs: 0, sleep: async () => {} },
    ),
    /UND_ERR_CONNECT_TIMEOUT/,
  );
  assert.equal(calls, 3);
});

test("Cloudflare retry classification is narrow and transport-specific", () => {
  for (const message of [
    "fetch failed",
    "read ECONNRESET",
    "UND_ERR_CONNECT_TIMEOUT",
    "socket hang up",
  ]) {
    assert.equal(isRetryableCloudflareError(new Error(message)), true, message);
  }
  assert.equal(isRetryableCloudflareError(new Error("release manifest mismatch")), false);
});

test("tracked API staging config is isolated and becomes executable only after provisioning", () => {
  const config = readStagingConfig();
  assert.doesNotThrow(() => validateStagingConfig(config, { allowPlaceholder: true }));
  if (config.d1_databases[0].database_id === PLACEHOLDER_DATABASE_ID) {
    assert.throws(
      () => validateStagingConfig(config),
      /non-executable placeholder/,
    );
  } else {
    assert.doesNotThrow(() => validateStagingConfig(config));
  }
});

test("fully provisioned API staging config passes the strict guard", () => {
  assert.deepEqual(validateStagingConfig(validConfig()), {
    workerName: STAGING_WORKER_NAME,
    databaseName: STAGING_DATABASE_NAME,
    databaseId: validDatabaseId,
    mediaBucket: STAGING_MEDIA_BUCKET,
    geoBucket: STAGING_GEO_BUCKET,
  });
});

test("withdrawal drill accepts only the staging workers.dev URL", () => {
  assert.equal(
    validateStagingBaseUrl("https://panda-atlas-api-staging.example.workers.dev/"),
    "https://panda-atlas-api-staging.example.workers.dev",
  );
  assert.throws(() => validateStagingBaseUrl("https://api.zhipanda.com"), /must target/);
  assert.throws(
    () => validateStagingBaseUrl("https://panda-atlas-api-staging.example.com"),
    /must target/,
  );
  assert.throws(
    () => validateStagingBaseUrl("http://panda-atlas-api-staging.example.workers.dev"),
    /must use HTTPS/,
  );
});

test("staging write actions fail before remote access without explicit execute", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--action", "bootstrap"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bootstrap requires explicit --execute/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /wrangler|Resource location/i);
});

test("staging drill rejects a Production base URL before remote access", () => {
  const result = spawnSync(
    process.execPath,
    [
      runnerPath,
      "--action",
      "drill",
      "--execute",
      "--base-url",
      "https://api.zhipanda.com",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must target panda-atlas-api-staging on workers\.dev/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Resource location/i);
});

for (const fixture of [
  {
    name: "production Worker name",
    mutate(config) {
      config.name = "panda-atlas-api";
    },
    error: /Staging Worker name/,
  },
  {
    name: "custom route",
    mutate(config) {
      config.routes = [{ pattern: "api.zhipanda.com", custom_domain: true }];
    },
    error: /must not declare custom routes/,
  },
  {
    name: "production environment",
    mutate(config) {
      config.vars.APP_ENV = "production";
    },
    error: /APP_ENV must be staging/,
  },
  {
    name: "production D1 name",
    mutate(config) {
      config.d1_databases[0].database_name = PRODUCTION_DATABASE_NAME;
    },
    error: /Staging D1 database/,
  },
  {
    name: "production D1 ID",
    mutate(config) {
      config.d1_databases[0].database_id = PRODUCTION_DATABASE_ID;
    },
    error: /Production D1 database ID is forbidden/,
  },
  {
    name: "production media bucket",
    mutate(config) {
      config.r2_buckets.find((item) => item.binding === "MEDIA_BUCKET").bucket_name = PRODUCTION_MEDIA_BUCKET;
    },
    error: /MEDIA_BUCKET must bind/,
  },
  {
    name: "missing geo bucket",
    mutate(config) {
      config.r2_buckets = config.r2_buckets.filter((item) => item.binding !== "GEO_BUCKET");
    },
    error: /exactly two R2 bindings/,
  },
]) {
  test(`API staging guard rejects ${fixture.name}`, () => {
    const config = structuredClone(validConfig());
    fixture.mutate(config);
    assert.throws(() => validateStagingConfig(config), fixture.error);
  });
}

test("staging reset rebuilds only versioned release storage and migration journal entries", () => {
  const sql = buildStagingReleaseResetSql();
  const viewIndex = sql.indexOf("drop view if exists current_public_records");
  const pointerIndex = sql.indexOf("drop table if exists public_release_pointer");
  const releaseIndex = sql.indexOf("drop table if exists public_releases");
  const journalIndex = sql.indexOf("delete from d1_migrations");
  assert.ok(viewIndex >= 0 && viewIndex < pointerIndex);
  assert.ok(pointerIndex < releaseIndex && releaseIndex < journalIndex);
  assert.match(sql, /create table if not exists d1_migrations/);
  assert.match(sql, /0005_versioned_public_releases\.sql/);
  assert.match(sql, /0007f_public_release_withdrawals_immutable_delete\.sql/);
  assert.doesNotMatch(sql, /drop table if exists pandas/);
  assert.doesNotMatch(sql, /delete from public_release_records/);
});

test("baseline import verification is bound to manifest counts", () => {
  const artifact = {
    releaseVersion: BASELINE_RELEASE,
    expectedRecords: 100,
    expectedApiPandas: 7,
  };
  const row = {
    current_release: BASELINE_RELEASE,
    release_rows: 1,
    record_rows: 100,
    api_panda_rows: 7,
    withdrawal_rows: 0,
  };
  assert.match(buildBaselineVerificationSql(), /api_pandas/);
  assert.equal(validateBaselineVerification(row, artifact), row);
  assert.throws(
    () => validateBaselineVerification({ ...row, record_rows: 99 }, artifact),
    /record count mismatch/,
  );
});

test("entity withdrawal SQL is append-only and source-scoped", () => {
  const sql = buildEntityWithdrawalSql({
    pandaId: "panda-1",
    reason: "Staging rights withdrawal drill",
    withdrawnAt: "2026-07-20T16:30:00Z",
  });
  assert.match(sql, /insert into public_release_withdrawals/);
  assert.match(sql, /'pandas'/);
  assert.match(sql, /returning id/);
  assert.doesNotMatch(sql, /update|delete/i);
  const verifySql = buildEntityWithdrawalVerificationSql({
    pandaId: "panda-1",
    unrelatedPandaId: "panda-2",
  });
  assert.match(verifySql, /withdrawal\.entity_type = 'pandas'/);
  assert.match(verifySql, /retained_panda_rows/);
});

test("entity withdrawal verification retains release and unrelated panda", () => {
  const row = {
    current_release: CURRENT_RELEASE,
    current_release_rows: 1,
    panda_withdrawal_rows: 1,
    retained_panda_rows: 1,
    visible_panda_rows: 0,
    unrelated_visible_rows: 1,
    retained_release_records: 198,
  };
  assert.equal(validateEntityWithdrawalVerification(row), row);
  assert.throws(
    () => validateEntityWithdrawalVerification({ ...row, unrelated_visible_rows: 0 }),
    /unrelated panda/,
  );
});

test("whole-release withdrawal SQL and verification preserve immutable history", () => {
  const sql = buildWholeReleaseWithdrawalSql({
    reason: "Staging whole-release withdrawal drill",
    withdrawnAt: "2026-07-20T16:35:00Z",
  });
  assert.match(sql, /null, null/);
  assert.match(sql, /returning id/);
  assert.doesNotMatch(sql, /update|delete/i);
  assert.match(buildWholeReleaseVerificationSql(), /current_public_records/);
  const row = {
    pointer_release: CURRENT_RELEASE,
    current_release_rows: 0,
    current_record_rows: 0,
    whole_withdrawal_rows: 1,
    retained_release_rows: 1,
    retained_record_rows: 198,
  };
  assert.equal(validateWholeReleaseVerification(row), row);
});

test("reviewed media inventory contains unique inherited and current immutable objects", () => {
  const objects = reviewedMediaObjects();
  assert.equal(objects.length, 14);
  assert.equal(new Set(objects.map((item) => item.objectKey)).size, 14);
  assert.ok(objects.some((item) => item.objectKey.startsWith("releases/2026.07.20.1/")));
  assert.ok(objects.some((item) => item.objectKey.startsWith("releases/2026.07.20.2/")));
  assert.equal(
    objects.filter((item) => item.objectKey.includes("media-ri-ri-03e20f3f6a0e2db3")).length,
    2,
  );
  assert.ok(objects.every((item) => item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256)));
});

test("HTTP evidence validators require the real baseline and withdrawal transitions", () => {
  assert.doesNotThrow(() =>
    assertBaselineHttpEvidence({
      release: {
        status: 200,
        body: { dataset_release_version: CURRENT_RELEASE },
        datasetVersion: CURRENT_RELEASE,
        publicSchemaVersion: "1.2.0",
        migrationVersion: "0007",
      },
      pandas: Array.from({ length: 4 }, () => ({
        status: 200,
        datasetVersion: CURRENT_RELEASE,
        publicSchemaVersion: "1.2.0",
        migrationVersion: "0007",
      })),
      media: {
        status: 200,
        contentType: "image/webp",
        cacheControl: "public, max-age=31536000, immutable",
      },
    }),
  );
  const entityEvidence = {
    release: { status: 200 },
    targetPanda: { status: 404 },
    unrelatedPanda: { status: 200 },
    withdrawnMedia: [{ status: 404 }, { status: 404 }],
    retainedMedia: [{ status: 200 }, { status: 200 }],
  };
  assert.doesNotThrow(() => assertEntityWithdrawalHttpEvidence(entityEvidence));
  assert.throws(
    () =>
      assertEntityWithdrawalHttpEvidence({
        ...entityEvidence,
        withdrawnMedia: [{ status: 404 }, { status: 200 }],
      }),
    /withdrawn Staging media derivative/,
  );
  assert.doesNotThrow(() =>
    assertWholeReleaseHttpEvidence({
      release: { status: 410 },
      pandas: { status: 410 },
    }),
  );
  assert.throws(
    () => assertWholeReleaseHttpEvidence({ release: { status: 200 }, pandas: { status: 200 } }),
    /did not return 410/,
  );
  const productionCanary = {
    status: 200,
    body: { dataset_release_version: CURRENT_RELEASE },
    datasetVersion: CURRENT_RELEASE,
    publicSchemaVersion: "1.2.0",
    migrationVersion: "0007",
  };
  assert.doesNotThrow(() =>
    assertProductionCanaryEvidence(productionCanary, structuredClone(productionCanary)),
  );
});
