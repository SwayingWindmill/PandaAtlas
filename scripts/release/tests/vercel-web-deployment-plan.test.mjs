import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadVercelWebDeploymentPlan,
  validateVercelWebDeploymentPlan,
} from "../check-vercel-web-deployment-plan.mjs";

function clonePlan() {
  return structuredClone(loadVercelWebDeploymentPlan());
}

test("Phase 1 Vercel Web plan is deployed and production-safe", () => {
  const summary = validateVercelWebDeploymentPlan(clonePlan());

  assert.equal(summary.status, "deployed-acceptance-in-progress");
  assert.equal(summary.root_directory, "apps/web");
  assert.equal(summary.preview_api_base_url, "https://api.zhipanda.com");
  assert.equal(summary.deployment_url, "https://zhipanda.vercel.app");
  assert.equal(summary.production_cutover_authorized, false);
  assert.equal(summary.acceptance_checks, 2);
  assert.ok(summary.incomplete_exit_criteria > 0);
});

test("Phase 1 Vercel Web plan rejects production authorization", () => {
  const plan = clonePlan();
  plan.production_cutover_authorized = true;
  plan.environments.production.traffic_cutover_authorized = true;
  plan.environments.production.domains = ["zhipanda.com"];

  assert.throws(
    () => validateVercelWebDeploymentPlan(plan, { checkWorkflow: false }),
    /must not authorize a production cutover/,
  );
});

test("Vercel production deployment remains detached from public traffic", () => {
  const plan = clonePlan();

  assert.equal(plan.environments.production.enabled, true);
  assert.equal(plan.environments.production.traffic_cutover_authorized, false);
  assert.deepEqual(plan.environments.production.domains, []);
  assert.equal(plan.deployment.custom_production_domains_attached, false);
  assert.equal(plan.deployment_protection.vercel_authentication_enabled, false);
  assert.equal(plan.deployment_protection.sso_protection, null);
  assert.equal(
    plan.environments.production.required_environment_variables[0].expected_value,
    "https://api.zhipanda.com",
  );
});

test("Phase 1 Vercel Web plan retains the current Cloudflare API boundary", () => {
  const plan = clonePlan();

  assert.equal(plan.environments.preview.api_base_url, "https://api.zhipanda.com");
  assert.equal(plan.rollback.current_api_runtime, "Cloudflare Worker panda-atlas-api");
  assert.equal(plan.rollback.current_production_unchanged, true);
  assert.equal(plan.rollback.dns_changes_required_for_phase_1, false);
});

test("Vercel acceptance workflow is read-only and requires no secrets", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/vercel-web-acceptance.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /\.vercel\.app/);
  assert.match(workflow, /PLAYWRIGHT_BASE_URL/);
  assert.match(workflow, /npm run smoke:web/);
  assert.match(workflow, /npm run test:accessibility -w web/);
  assert.doesNotMatch(workflow, /\bvercel\s+(deploy|promote|rollback)\b/i);
  assert.doesNotMatch(workflow, /secrets\./i);
  assert.doesNotMatch(workflow, /zhipanda\.com/);
});

test("Phase 1 avoids unneeded Vercel build overrides", () => {
  const plan = clonePlan();

  assert.equal(plan.project.install_command_override, null);
  assert.equal(plan.project.build_command_override, null);
  assert.equal(plan.project.output_directory_override, null);
});
