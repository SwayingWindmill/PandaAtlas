import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createMapCloseCertificationPlan,
  MAP_CLOSE_PROFILE,
  MAP_CLOSE_WEB_ENVIRONMENT,
} from "../certification/map-close-plan.mjs";

const packagePath = new URL("../../../package.json", import.meta.url);
const workflowPath = new URL("../../../.github/workflows/release-gate.yml", import.meta.url);
const mapClosePath = new URL("../map-close.mjs", import.meta.url);
const windowsMapClosePath = new URL("../windows-map-close.mjs", import.meta.url);
const planPath = new URL("../certification/map-close-plan.mjs", import.meta.url);
const lifecyclePath = new URL("../certification/lifecycle.mjs", import.meta.url);
const extendedPath = new URL("../extended.mjs", import.meta.url);

const authoritativeStepIds = [
  "archive-governance-evidence",
  "archive-governance-inventory",
  "archive-governance-contracts",
  "archive-governance-openapi",
  "archive-governance-web-contracts",
  "admin-bundle-budget",
  "structured-contribution-evidence",
  "notification-center-budget",
  "zhipanda-brand-closure",
  "supabase-foundation-contracts",
  "identity-engagement-contracts",
  "secure-web-boundary",
  "follow-through-login-browser",
  "published-return-loop-browser",
  "admin-shell-browser",
];

const windowsStepIds = [
  "release-contracts",
  "web-lint",
  "web-typecheck",
  "web-build",
  "api-sync",
  "api-lint",
  "api-tests",
  "published-return-loop-browser",
];

function assertDependencyClosure(plan) {
  const ids = new Set(plan.steps.map((step) => step.id));
  assert.equal(ids.size, plan.steps.length);
  for (const step of plan.steps) {
    for (const dependency of step.dependsOn ?? []) {
      assert.ok(ids.has(dependency), `${step.id} depends on missing ${dependency}`);
    }
  }
}

test("map-close is an explicit authoritative release mode", async () => {
  const rootPackage = JSON.parse(await readFile(packagePath, "utf8"));
  const workflow = await readFile(workflowPath, "utf8");
  const mapClose = await readFile(mapClosePath, "utf8");
  const windowsMapClose = await readFile(windowsMapClosePath, "utf8");
  const planSource = await readFile(planPath, "utf8");
  const lifecycleSource = await readFile(lifecyclePath, "utf8");
  const extended = await readFile(extendedPath, "utf8");

  assert.equal(rootPackage.scripts["release:private"], "node scripts/release/private-collection.mjs");
  assert.equal(rootPackage.scripts["release:map-close"], "node scripts/release/map-close.mjs");
  assert.equal(
    rootPackage.scripts["check:zhipanda-brand-closure"],
    "node scripts/release/check-zhipanda-brand-closure.mjs",
  );
  assert.equal(
    rootPackage.scripts["drill:identity-engagement-recovery"],
    "uv run --directory services/api --frozen --extra dev python scripts/run_identity_engagement_recovery_drill.py",
  );
  assert.match(workflow, /run: npm run release:map-close/);
  assert.match(workflow, /npm run infra:reset/);
  assert.match(workflow, /npm run infra:preflight/);
  assert.match(workflow, /npm run drill:identity-engagement-recovery/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /release-gate-map-close-windows/);
  assert.match(workflow, /needs: \[release-gate, release-gate-windows\]/);
  assert.match(workflow, /test_activity_projection_real_db\.py/);
  assert.match(workflow, /test_feed_real_db\.py/);
  assert.match(workflow, /test_notification_real_db\.py/);
  assert.match(workflow, /drill:notification-staging/);
  assert.match(
    workflow,
    /name: Record Resend and Auth SMTP staging evidence[\s\S]*?continue-on-error: true[\s\S]*?run: npm run drill:notification-staging[\s\S]*?name: Seal published-return foundation evidence[\s\S]*?if: always\(\)/,
  );
  assert.match(workflow, /RUN_NOTIFICATION_STAGING: "1"/);
  assert.match(workflow, /AUTH_SMTP_HOST: \$\{\{ secrets\.AUTH_SMTP_HOST \}\}/);
  assert.match(workflow, /AUTH_SMTP_PORT: \$\{\{ secrets\.AUTH_SMTP_PORT \}\}/);
  assert.match(workflow, /AUTH_SMTP_FROM_EMAIL: \$\{\{ secrets\.AUTH_SMTP_FROM_EMAIL \}\}/);
  assert.match(workflow, /seal-published-return-evidence\.mjs/);

  assert.match(mapClose, /runDefaultReleaseGate/);
  assert.match(mapClose, /MAP_CLOSE_PROFILE\.AUTHORITATIVE/);
  assert.match(mapClose, /MAP_CLOSE_WEB_ENVIRONMENT/);
  assert.match(mapClose, /runEvidenceSealedCertification/);
  assert.doesNotMatch(mapClose, /steps:\s*\[/);
  assert.match(windowsMapClose, /MAP_CLOSE_PROFILE\.WINDOWS_COMPATIBILITY/);
  assert.doesNotMatch(windowsMapClose, /steps:\s*\[/);

  assert.match(planSource, /archive-governance-evidence/);
  assert.match(planSource, /validate-archive-governance-evidence\.mjs/);
  assert.match(planSource, /archive-governance-inventory/);
  assert.match(planSource, /check:archive-governance-migration/);
  assert.match(planSource, /archive-governance-contracts/);
  assert.match(planSource, /tests\/archive_publication/);
  assert.match(planSource, /tests\/archive_operations/);
  assert.match(planSource, /tests\/archive_workbench/);
  assert.match(planSource, /test_archive_governance_canonical_openapi\.py/);
  assert.match(planSource, /archive-governance-openapi/);
  assert.match(planSource, /build_archive_governance_openapi\.py/);
  assert.match(planSource, /panda-atlas-v1-integrated\.yaml/);
  assert.match(planSource, /archive-governance-web-contracts/);
  assert.match(planSource, /archive-governance-evidence\.test\.mjs/);
  assert.match(planSource, /archive-workbench\.test\.mjs/);
  assert.match(planSource, /admin-bundle-budget/);
  assert.match(planSource, /check-admin-bundle-budget\.mjs/);
  assert.match(planSource, /mobile, keyboard, and WCAG/);
  assert.match(planSource, /structured-contribution-evidence/);
  assert.match(planSource, /validate-structured-contribution-evidence.mjs/);
  assert.match(planSource, /zhipanda-brand-closure/);
  assert.match(planSource, /check-zhipanda-brand-closure.mjs/);
  assert.match(planSource, /identity-engagement-contracts/);
  assert.match(planSource, /secure-web-boundary/);
  assert.match(planSource, /follow-through-login-browser/);
  assert.match(planSource, /published-return-loop-browser/);
  assert.match(planSource, /published-return-loop\.spec\.ts/);
  assert.match(planSource, /admin-shell-browser/);

  assert.match(lifecycleSource, /runReleaseGate/);
  assert.match(lifecycleSource, /sealMapCloseEvidence/);
  assert.match(extended, /runMapCloseGate/);
  assert.match(extended, /RUN_IDENTITY_ENGAGEMENT_RECOVERY/);
  assert.match(extended, /test_engagement_real_db\.py/);
  assert.match(extended, /runEvidenceSealedCertification/);
});

test("authoritative and Windows adapters preserve their certified profiles", () => {
  const authoritative = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.AUTHORITATIVE,
    playwrightEnv: { PLAYWRIGHT_BROWSER_CHANNEL: "chromium" },
  });
  const windows = createMapCloseCertificationPlan({
    profile: MAP_CLOSE_PROFILE.WINDOWS_COMPATIBILITY,
  });

  assert.equal(authoritative.gate, "map-close");
  assert.deepEqual(authoritative.steps.map((step) => step.id), authoritativeStepIds);
  assertDependencyClosure(authoritative);

  assert.equal(windows.gate, "windows-map-close-compatibility");
  assert.deepEqual(windows.steps.map((step) => step.id), windowsStepIds);
  assertDependencyClosure(windows);
});

test("map-close profiles share one immutable public Web environment", () => {
  assert.deepEqual(MAP_CLOSE_WEB_ENVIRONMENT, {
    NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:65535",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65534",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    NEXT_PUBLIC_ENGAGEMENT_ENABLED: "true",
    NEXT_PUBLIC_FEED_ENABLED: "true",
    NEXT_PUBLIC_NOTIFICATION_ENABLED: "true",
  });
  assert.ok(Object.isFrozen(MAP_CLOSE_WEB_ENVIRONMENT));
  assert.throws(
    () => createMapCloseCertificationPlan({ profile: "unknown" }),
    /Unknown map-close certification profile/,
  );
});
