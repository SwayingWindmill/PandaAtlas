import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../../.github/workflows/release-gate.yml", import.meta.url);
const defaultGatePath = new URL("../default.mjs", import.meta.url);
const extendedGatePath = new URL("../extended.mjs", import.meta.url);
const workerPackagePath = new URL("../../../services/worker-api/package.json", import.meta.url);
const workerSmokePath = new URL("../../../services/worker-api/scripts/smoke_test_worker.mjs", import.meta.url);
const workerProductionWranglerPath = new URL("../../../services/worker-api/wrangler.jsonc", import.meta.url);
const workerStagingWranglerPath = new URL("../../../services/worker-api/wrangler.staging.jsonc", import.meta.url);
const webPackagePath = new URL("../../../apps/web/package.json", import.meta.url);
const webPlaywrightConfigPath = new URL("../../../apps/web/playwright.config.ts", import.meta.url);
const webProductionWranglerPath = new URL("../../../apps/web/wrangler.jsonc", import.meta.url);
const webStagingWranglerPath = new URL("../../../apps/web/wrangler.staging.jsonc", import.meta.url);
const packageLockPath = new URL("../../../package-lock.json", import.meta.url);
const rootPackagePath = new URL("../../../package.json", import.meta.url);

test("CI declares reproducible Linux and Windows default gates", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  for (const requiredText of [
    "os: ubuntu-latest",
    "os: windows-latest",
    'NPM_VERSION: "10.9.0"',
    'PYTHON_VERSION: "3.12"',
    'UV_VERSION: "0.11.7"',
    "run: npm ci",
    "npx playwright install --with-deps chromium",
    "npx playwright install chromium",
    "uses: actions/checkout@v7.0.0",
    "uses: actions/setup-node@v6.4.0",
    "uses: actions/setup-python@v6.3.0",
    "uses: actions/upload-artifact@v7.0.1",
    "include-hidden-files: true",
    "if-no-files-found: error",
    "run: git diff --exit-code",
  ]) {
    assert.match(workflow, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("default gate includes golden dataset validation", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");

  assert.match(defaultGate, /test:golden-dataset/);
  assert.match(defaultGate, /Golden dataset contract/);
});

test("default gate includes panda curation and minimum photo validation", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(rootPackage.scripts["test:panda-curation"], "python -m unittest discover -s scripts/curation/tests -p \"test_validate_panda_curation.py\"");
  assert.equal(rootPackage.scripts["check:panda-curation"], "python scripts/curation/validate_panda_curation.py");
  assert.match(defaultGate, /id: "panda-curation-contract"/);
  assert.match(defaultGate, /id: "panda-curation-data"/);
  assert.match(defaultGate, /dependsOn: \["panda-curation-contract"\]/);
  assert.equal(
    rootPackage.scripts["test:panda-media"],
    "uv run --isolated --directory services/api --frozen --extra dev python -m unittest discover -s ../../scripts/curation/tests -p \"test_process_panda_media.py\"",
  );
  assert.match(defaultGate, /id: "panda-media-pipeline"/);
  assert.match(defaultGate, /dependsOn: \["panda-curation-data"\]/);
  assert.equal(
    rootPackage.scripts["check:atlanta-photo-batch"],
    "python scripts/curation/build_atlanta_photo_batch.py --check",
  );
  assert.equal(
    rootPackage.scripts["check:atlanta-photo-release"],
    "node scripts/release/check-beta-hard-gates.mjs --dataset data/reviewed-batches/2026.07.20.1/source.json --report .release-gate/atlanta-photo-hard-gates.json",
  );
  assert.match(defaultGate, /id: "atlanta-photo-batch"/);
  assert.match(defaultGate, /id: "atlanta-photo-batch-tests"/);
  assert.match(defaultGate, /id: "atlanta-photo-hard-gates"/);
  assert.match(defaultGate, /dependsOn: \["atlanta-photo-batch-tests", "web-build"\]/);
  assert.equal(
    rootPackage.scripts["check:ueno-family-photo-batch"],
    "python scripts/curation/build_ueno_family_photo_batch.py --check",
  );
  assert.equal(
    rootPackage.scripts["check:ueno-family-photo-release"],
    "node scripts/release/check-beta-hard-gates.mjs --dataset data/reviewed-batches/2026.07.20.2/source.json --report .release-gate/ueno-family-photo-hard-gates.json",
  );
  assert.match(defaultGate, /id: "ueno-family-photo-batch"/);
  assert.match(defaultGate, /id: "ueno-family-photo-batch-tests"/);
  assert.match(defaultGate, /id: "ueno-family-photo-hard-gates"/);
  assert.match(defaultGate, /dependsOn: \["ueno-family-photo-batch-tests", "web-build"\]/);
});

test("default gate records automated core WCAG checks", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));

  assert.equal(
    webPackage.scripts["test:accessibility"],
    "playwright test --config playwright.accessibility.config.ts",
  );
  assert.match(defaultGate, /id: "web-accessibility"/);
  assert.match(defaultGate, /dependsOn: \["web-build", "browser-runtime"\]/);
  assert.match(defaultGate, /test:accessibility/);
});

test("release browser checks reuse the clean production build and honor the Edge opt-out", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const playwrightConfig = await readFile(webPlaywrightConfigPath, "utf8");

  assert.match(defaultGate, /PLAYWRIGHT_NEXT_DIST_DIR: "\.next"/);
  assert.match(playwrightConfig, /process\.env\.PLAYWRIGHT_NEXT_DIST_DIR/);
  assert.match(playwrightConfig, /process\.env\.RELEASE_GATE_USE_SYSTEM_EDGE !== "0"/);
});

test("Cloudflare staging deploy is isolated from production routes", async () => {
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  const productionConfig = JSON.parse(await readFile(webProductionWranglerPath, "utf8"));
  const stagingConfig = JSON.parse(await readFile(webStagingWranglerPath, "utf8"));

  assert.equal(
    webPackage.scripts["deploy:cf:staging"],
    "opennextjs-cloudflare build && wrangler deploy --config wrangler.staging.jsonc",
  );
  assert.notEqual(stagingConfig.name, productionConfig.name);
  assert.equal(stagingConfig.name, "panda-atlas-web-staging");
  assert.equal(stagingConfig.workers_dev, true);
  assert.deepEqual(stagingConfig.routes, []);
  for (const sharedKey of [
    "main",
    "compatibility_date",
    "compatibility_flags",
    "assets",
    "observability",
    "vars",
  ]) {
    assert.deepEqual(stagingConfig[sharedKey], productionConfig[sharedKey]);
  }
});

test("Cloudflare API staging deploy is isolated from Production D1, R2, and routes", async () => {
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
  const workerPackage = JSON.parse(await readFile(workerPackagePath, "utf8"));
  const production = JSON.parse(await readFile(workerProductionWranglerPath, "utf8"));
  const staging = JSON.parse(await readFile(workerStagingWranglerPath, "utf8"));

  assert.equal(
    workerPackage.scripts["deploy:staging"],
    "wrangler deploy --config wrangler.staging.jsonc",
  );
  assert.equal(
    rootPackage.scripts["staging:api:plan"],
    "node scripts/release/run-api-staging-withdrawal.mjs --action plan",
  );
  for (const script of [
    "staging:api:bootstrap",
    "staging:api:deploy",
    "staging:api:drill",
    "staging:api:full",
  ]) {
    assert.match(rootPackage.scripts[script], /--execute$/);
  }

  assert.equal(staging.name, "panda-atlas-api-staging");
  assert.notEqual(staging.name, production.name);
  assert.equal(staging.workers_dev, true);
  assert.deepEqual(staging.routes, []);
  assert.equal(staging.vars.APP_ENV, "staging");
  assert.equal(production.vars.APP_ENV, "production");
  for (const sharedKey of ["main", "compatibility_date", "observability"]) {
    assert.deepEqual(staging[sharedKey], production[sharedKey]);
  }

  assert.equal(staging.d1_databases.length, 1);
  assert.equal(staging.d1_databases[0].binding, "DB");
  assert.equal(staging.d1_databases[0].database_name, "panda-atlas-staging");
  assert.notEqual(
    staging.d1_databases[0].database_id,
    production.d1_databases[0].database_id,
  );
  assert.equal(
    staging.d1_databases[0].migrations_dir,
    production.d1_databases[0].migrations_dir,
  );

  const stagingBuckets = new Map(
    staging.r2_buckets.map((item) => [item.binding, item.bucket_name]),
  );
  const productionBuckets = new Map(
    production.r2_buckets.map((item) => [item.binding, item.bucket_name]),
  );
  assert.equal(stagingBuckets.get("MEDIA_BUCKET"), "panda-atlas-media-staging");
  assert.equal(stagingBuckets.get("GEO_BUCKET"), "panda-atlas-geo-staging");
  assert.notEqual(stagingBuckets.get("MEDIA_BUCKET"), productionBuckets.get("MEDIA_BUCKET"));
  assert.notEqual(stagingBuckets.get("GEO_BUCKET"), productionBuckets.get("GEO_BUCKET"));
});

test("default gate runs the Beta hard-gate preflight after the production build", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.scripts["check:beta-hard-gates"],
    "node scripts/release/check-beta-hard-gates.mjs",
  );
  assert.match(defaultGate, /id: "beta-hard-gates"/);
  assert.match(defaultGate, /dependsOn: \["golden-dataset", "web-build"\]/);
  assert.match(defaultGate, /check:beta-hard-gates/);
});

test("default gate records the release recovery drill after locked API setup", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.scripts["drill:release-recovery"],
    "uv run --directory services/api --frozen --extra dev python scripts/run_release_recovery_drill.py",
  );
  assert.match(defaultGate, /id: "release-recovery-drill"/);
  assert.match(
    defaultGate,
    /dependsOn: \[[\s\S]*"api-sync",[\s\S]*"beta-hard-gates",[\s\S]*"atlanta-photo-hard-gates",[\s\S]*"ueno-family-photo-hard-gates",[\s\S]*\]/,
  );
  assert.match(defaultGate, /run_release_recovery_drill\.py/);
});

test("extended gate can require the PostgreSQL and attachment recovery drill", async () => {
  const extendedGate = await readFile(extendedGatePath, "utf8");
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.scripts["drill:postgres-attachment-recovery"],
    "uv run --directory services/api --frozen --extra dev python scripts/run_postgres_attachment_recovery_drill.py",
  );
  assert.match(extendedGate, /RUN_POSTGRES_ATTACHMENT_RECOVERY/);
  assert.match(extendedGate, /id: "postgres-attachment-recovery"/);
  assert.match(extendedGate, /run_postgres_attachment_recovery_drill\.py/);
});

test("default gate separates D1 and HTTP Worker smoke", async () => {
  const defaultGate = await readFile(defaultGatePath, "utf8");
  const workerPackage = JSON.parse(await readFile(workerPackagePath, "utf8"));

  assert.match(defaultGate, /id: "worker-d1-rollback-smoke"/);
  assert.match(defaultGate, /smoke:api:cf:d1:rollback/);
  assert.match(defaultGate, /dependsOn: \["worker-d1-rollback-smoke"\]/);
  assert.match(defaultGate, /smoke:api:cf:d1/);
  assert.match(defaultGate, /smoke:api:cf:http/);
  assert.match(defaultGate, /process\.platform === "win32"/);
  assert.equal(
    workerPackage.scripts["smoke:d1"],
    "node scripts/smoke_test_worker.mjs --mode=d1 --release=2026.07.20.2",
  );
  assert.equal(
    workerPackage.scripts["smoke:d1:rollback"],
    "node scripts/smoke_test_worker.mjs --mode=d1 --release=2026.07.20.1",
  );
  assert.equal(
    workerPackage.scripts["smoke:http"],
    "node scripts/smoke_test_worker.mjs --mode=http --release=2026.07.20.2",
  );
});

test("Worker HTTP smoke covers the activated Ueno release", async () => {
  const workerSmoke = await readFile(workerSmokePath, "utf8");

  assert.match(workerSmoke, /releaseVersion === "2026\.07\.20\.2"/);
  for (const slug of ["ri-ri", "shin-shin", "xiao-xiao", "lei-lei"]) {
    assert.match(workerSmoke, new RegExp(`"${slug}"`));
  }
  assert.match(workerSmoke, /Worker Ueno detail was incomplete/);
  assert.match(workerSmoke, /Worker Ueno parentage was incomplete/);
});

test("Worker D1 migration scripts use the atomic trigger-safe runner", async () => {
  const workerPackage = JSON.parse(await readFile(workerPackagePath, "utf8"));

  assert.match(workerPackage.scripts["d1:migrate"], /apply-d1-migrations\.mjs/);
  assert.match(workerPackage.scripts["d1:migrate:local"], /apply-d1-migrations\.mjs/);
  assert.doesNotMatch(workerPackage.scripts["d1:migrate"], /wrangler d1 migrations apply/);
  assert.doesNotMatch(workerPackage.scripts["d1:migrate:local"], /wrangler d1 migrations apply/);
});

test("root package exposes guarded Public Release D1 activation and rollback commands", async () => {
  const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));

  assert.equal(
    rootPackage.scripts["release:d1:preflight"],
    "node scripts/release/apply-public-release-d1.mjs",
  );
  assert.equal(
    rootPackage.scripts["release:d1:apply"],
    "node scripts/release/apply-public-release-d1.mjs --execute",
  );
  assert.equal(
    rootPackage.scripts["release:d1:rollback:preflight"],
    "node scripts/release/rollback-public-release-d1.mjs",
  );
  assert.equal(
    rootPackage.scripts["release:d1:rollback"],
    "node scripts/release/rollback-public-release-d1.mjs --execute",
  );
});

test("web lockfile retains Linux native optional packages", async () => {
  const webPackage = JSON.parse(await readFile(webPackagePath, "utf8"));
  const packageLock = JSON.parse(await readFile(packageLockPath, "utf8"));
  const expectedPackages = {
    "@tailwindcss/oxide-linux-x64-gnu": "4.2.1",
    "lightningcss-linux-x64-gnu": "1.31.1",
  };

  assert.deepEqual(webPackage.optionalDependencies, expectedPackages);
  for (const [packageName, version] of Object.entries(expectedPackages)) {
    const lockEntry = packageLock.packages[`node_modules/${packageName}`];
    assert.equal(lockEntry?.version, version);
    assert.equal(lockEntry?.optional, true);
    assert.deepEqual(lockEntry?.os, ["linux"]);
    assert.deepEqual(lockEntry?.cpu, ["x64"]);
  }
});
