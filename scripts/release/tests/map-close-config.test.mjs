import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packagePath = new URL("../../../package.json", import.meta.url);
const workflowPath = new URL("../../../.github/workflows/release-gate.yml", import.meta.url);
const mapClosePath = new URL("../map-close.mjs", import.meta.url);
const extendedPath = new URL("../extended.mjs", import.meta.url);

test("map-close is an explicit authoritative release mode", async () => {
  const rootPackage = JSON.parse(await readFile(packagePath, "utf8"));
  const workflow = await readFile(workflowPath, "utf8");
  const mapClose = await readFile(mapClosePath, "utf8");
  const extended = await readFile(extendedPath, "utf8");

  assert.equal(rootPackage.scripts["release:private"], "node scripts/release/private-collection.mjs");
  assert.equal(rootPackage.scripts["release:map-close"], "node scripts/release/map-close.mjs");
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
  assert.match(workflow, /RUN_NOTIFICATION_STAGING: "1"/);
  assert.match(workflow, /AUTH_SMTP_HOST: \$\{\{ secrets\.AUTH_SMTP_HOST \}\}/);
  assert.match(workflow, /AUTH_SMTP_PORT: \$\{\{ secrets\.AUTH_SMTP_PORT \}\}/);
  assert.match(workflow, /AUTH_SMTP_FROM_EMAIL: \$\{\{ secrets\.AUTH_SMTP_FROM_EMAIL \}\}/);
  assert.match(workflow, /seal-published-return-evidence\.mjs/);
  assert.match(mapClose, /runDefaultReleaseGate/);
  assert.match(mapClose, /NEXT_PUBLIC_ENGAGEMENT_ENABLED/);
  assert.match(mapClose, /NEXT_PUBLIC_FEED_ENABLED/);
  assert.match(mapClose, /NEXT_PUBLIC_NOTIFICATION_ENABLED/);
  assert.match(mapClose, /structured-contribution-evidence/);
  assert.match(mapClose, /validate-structured-contribution-evidence\.mjs/);
  assert.match(mapClose, /identity-engagement-contracts/);
  assert.match(mapClose, /secure-web-boundary/);
  assert.match(mapClose, /follow-through-login-browser/);
  assert.match(mapClose, /published-return-loop-browser/);
  assert.match(mapClose, /published-return-loop\.spec\.ts/);
  assert.match(mapClose, /admin-shell-browser/);
  assert.match(mapClose, /sealMapCloseEvidence/);
  assert.match(extended, /runMapCloseGate/);
  assert.match(extended, /RUN_IDENTITY_ENGAGEMENT_RECOVERY/);
  assert.match(extended, /test_engagement_real_db\.py/);
  assert.match(extended, /sealMapCloseEvidence/);
});
