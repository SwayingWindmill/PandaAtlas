import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export const defaultPlanPath = path.join(
  repositoryRoot,
  "contracts",
  "vercel-web-deployment.v1.json",
);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireText(errors, text, expected, label) {
  if (!text.includes(expected)) {
    errors.push(`Vercel acceptance workflow must include ${label}.`);
  }
}

export function loadVercelWebDeploymentPlan(filePath = defaultPlanPath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateVercelWebDeploymentPlan(
  plan,
  {
    root = repositoryRoot,
    checkWorkflow = true,
  } = {},
) {
  const errors = [];

  if (plan.schema_version !== 1) errors.push("schema_version must be 1.");
  if (plan.plan_id !== "vercel-web-phase-1") {
    errors.push("plan_id must be vercel-web-phase-1.");
  }
  if (plan.decision !== "docs/architecture/adr-0002-managed-cloud-deployment-target.md") {
    errors.push("Plan must bind to ADR 0002.");
  }
  const allowedStatuses = new Set([
    "repository-ready-account-setup-required",
    "deployed-acceptance-in-progress",
  ]);
  if (!allowedStatuses.has(plan.status)) {
    errors.push("Phase 1 plan has an unsupported status.");
  }
  if (plan.production_cutover_authorized !== false) {
    errors.push("Phase 1 must not authorize a production cutover.");
  }
  if (plan.cloudflare_production_changes_authorized !== false) {
    errors.push("Phase 1 must not authorize Cloudflare production changes.");
  }

  const project = plan.project ?? {};
  if (project.root_directory !== "apps/web") {
    errors.push("Vercel Root Directory must be apps/web.");
  }
  if (project.framework !== "nextjs") {
    errors.push("Vercel framework must remain nextjs.");
  }
  if (project.production_branch !== "master") {
    errors.push("Vercel production branch must match repository branch master.");
  }
  if (project.git_integration !== "required") {
    errors.push("Phase 1 requires Vercel Git integration.");
  }
  for (const key of [
    "install_command_override",
    "build_command_override",
    "output_directory_override",
  ]) {
    if (project[key] !== null) {
      errors.push(`${key} must remain null until a measured need justifies an override.`);
    }
  }

  if (plan.status === "deployed-acceptance-in-progress") {
    if (!isNonEmptyString(project.vercel_project_id)) {
      errors.push("Deployed Phase 1 status requires a Vercel project ID.");
    }
    if (!isNonEmptyString(project.vercel_team_id)) {
      errors.push("Deployed Phase 1 status requires a Vercel team ID.");
    }
    const deployment = plan.deployment ?? {};
    if (!isNonEmptyString(deployment.deployment_id)) {
      errors.push("Deployed Phase 1 status requires a deployment ID.");
    }
    if (!isNonEmptyString(deployment.deployment_url)
      || !deployment.deployment_url.endsWith(".vercel.app")) {
      errors.push("Deployed Phase 1 status requires a vercel.app deployment URL.");
    }
    if (deployment.state !== "READY") {
      errors.push("Recorded Vercel deployment must be READY.");
    }
    if (deployment.custom_production_domains_attached !== false) {
      errors.push("Phase 1 deployment must not attach production custom domains.");
    }
    const protection = plan.deployment_protection ?? {};
    if (protection.vercel_authentication_enabled !== false
      || protection.sso_protection !== null) {
      errors.push("Phase 1 external acceptance requires Vercel Authentication to be disabled.");
    }
  }

  const preview = plan.environments?.preview ?? {};
  if (preview.enabled !== true) errors.push("Preview environment must be enabled.");
  if (preview.api_base_url !== "https://api.zhipanda.com") {
    errors.push("Preview must continue to use the current public API base URL.");
  }
  if (!Array.isArray(preview.required_secrets) || preview.required_secrets.length !== 0) {
    errors.push("Initial Vercel Web preview must not require secrets.");
  }
  const apiVariable = preview.required_environment_variables?.find(
    (variable) => variable.name === "NEXT_PUBLIC_API_BASE_URL",
  );
  if (!apiVariable || apiVariable.value_class !== "public") {
    errors.push("NEXT_PUBLIC_API_BASE_URL must be recorded as public preview configuration.");
  }
  if (apiVariable?.expected_value !== "https://api.zhipanda.com") {
    errors.push("NEXT_PUBLIC_API_BASE_URL preview value must remain https://api.zhipanda.com.");
  }

  const production = plan.environments?.production ?? {};
  if (production.enabled !== true) {
    errors.push("The connected production branch must be deployable on Vercel.");
  }
  if (production.traffic_cutover_authorized !== false) {
    errors.push("The Vercel production environment must not authorize public traffic cutover.");
  }
  if (!Array.isArray(production.domains) || production.domains.length !== 0) {
    errors.push("No production domains may be attached during Phase 1 repository preparation.");
  }
  for (const hostname of ["zhipanda.com", "www.zhipanda.com"]) {
    if (!production.pending_domains?.includes(hostname)) {
      errors.push(`Production domain ${hostname} must remain pending.`);
    }
  }
  const productionApiVariable = production.required_environment_variables?.find(
    (variable) => variable.name === "NEXT_PUBLIC_API_BASE_URL",
  );
  if (!productionApiVariable || productionApiVariable.value_class !== "public") {
    errors.push("NEXT_PUBLIC_API_BASE_URL must be recorded as public production configuration.");
  }
  if (productionApiVariable?.expected_value !== "https://api.zhipanda.com") {
    errors.push("NEXT_PUBLIC_API_BASE_URL production value must remain https://api.zhipanda.com.");
  }

  const acceptance = plan.acceptance ?? {};
  if (acceptance.trigger !== "workflow_dispatch") {
    errors.push("Initial acceptance workflow must be manually dispatched with an explicit URL.");
  }
  if (acceptance.base_url_input !== "base_url") {
    errors.push("Acceptance workflow input must be base_url.");
  }
  if (acceptance.allowed_hostname_suffix !== ".vercel.app") {
    errors.push("Initial acceptance must be restricted to vercel.app deployment hosts.");
  }
  for (const requiredCheck of ["browser-smoke", "automated-accessibility"]) {
    if (!acceptance.checks?.includes(requiredCheck)) {
      errors.push(`Acceptance plan is missing ${requiredCheck}.`);
    }
  }
  const deployedFeatureProfile = acceptance.deployed_feature_profile ?? {};
  if (deployedFeatureProfile.engagement_enabled !== false) {
    errors.push("Phase 1 acceptance must match the current production Engagement-disabled Web profile.");
  }
  if (deployedFeatureProfile.notification_enabled !== false) {
    errors.push("Phase 1 acceptance must match the current production Notification-disabled Web profile.");
  }
  if (!isNonEmptyString(deployedFeatureProfile.basis)) {
    errors.push("Phase 1 deployed feature profile must record its production-equivalence basis.");
  }
  if (!isNonEmptyString(acceptance.workflow)) {
    errors.push("Acceptance workflow path is required.");
  }
  if (plan.status === "deployed-acceptance-in-progress") {
    if (!isNonEmptyString(acceptance.evidence)
      || !existsSync(path.join(root, acceptance.evidence))) {
      errors.push("Deployed Phase 1 status requires an existing acceptance evidence file.");
    }
    if (acceptance.current_result !== "incomplete") {
      errors.push("Phase 1 must remain incomplete until every exit criterion passes.");
    }
  }

  const workflowPath = isNonEmptyString(acceptance.workflow)
    ? path.join(root, acceptance.workflow)
    : null;
  if (checkWorkflow && workflowPath) {
    if (!existsSync(workflowPath)) {
      errors.push(`Acceptance workflow does not exist: ${acceptance.workflow}.`);
    } else {
      const workflow = readFileSync(workflowPath, "utf8");
      requireText(errors, workflow, "workflow_dispatch:", "workflow_dispatch");
      requireText(errors, workflow, "base_url:", "the base_url input");
      requireText(errors, workflow, ".vercel.app", "the vercel.app host boundary");
      requireText(errors, workflow, "PLAYWRIGHT_BASE_URL", "PLAYWRIGHT_BASE_URL");
      requireText(
        errors,
        workflow,
        'PLAYWRIGHT_DEPLOYED_ENGAGEMENT_ENABLED: "0"',
        "the production-equivalent Engagement-disabled profile",
      );
      requireText(
        errors,
        workflow,
        'PLAYWRIGHT_DEPLOYED_NOTIFICATION_ENABLED: "0"',
        "the production-equivalent Notification-disabled profile",
      );
      requireText(errors, workflow, "npm run smoke:web", "browser smoke");
      requireText(
        errors,
        workflow,
        "npm run test:accessibility -w web",
        "automated accessibility",
      );
      if (/\bvercel\s+(deploy|promote|rollback)\b/i.test(workflow)) {
        errors.push("Acceptance workflow must not deploy, promote, or roll back Vercel production.");
      }
      if (/secrets\./i.test(workflow)) {
        errors.push("Initial Vercel Web acceptance workflow must not require repository secrets.");
      }
      for (const hostname of ["zhipanda.com", "www.zhipanda.com"]) {
        if (workflow.includes(hostname)) {
          errors.push(`Acceptance workflow must not target production hostname ${hostname}.`);
        }
      }
    }
  }

  const rollback = plan.rollback ?? {};
  if (rollback.current_production_unchanged !== true) {
    errors.push("Current production must remain unchanged during Phase 1 preparation.");
  }
  if (rollback.dns_changes_required_for_phase_1 !== false) {
    errors.push("Phase 1 preparation must not require DNS changes.");
  }
  if (rollback.current_public_api_base_url !== "https://api.zhipanda.com") {
    errors.push("Rollback boundary must retain the current public API URL.");
  }

  if (!Array.isArray(plan.external_setup_required) || plan.external_setup_required.length < 5) {
    errors.push("External Vercel account setup steps must be explicit.");
  }
  const exitCriteria = Array.isArray(plan.phase_1_exit_criteria)
    ? plan.phase_1_exit_criteria
    : [];
  if (exitCriteria.length === 0) {
    errors.push("Phase 1 exit criteria must be recorded.");
  }
  if (exitCriteria.every((criterion) => criterion.complete === true)) {
    errors.push("Phase 1 cannot be marked complete before a real preview deployment is verified.");
  }

  if (errors.length > 0) {
    throw new Error(`Vercel Web deployment plan validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    plan_id: plan.plan_id,
    status: plan.status,
    root_directory: project.root_directory,
    preview_api_base_url: preview.api_base_url,
    deployment_url: plan.deployment?.stable_project_url ?? null,
    acceptance_checks: acceptance.checks.length,
    production_cutover_authorized: false,
    external_setup_steps: plan.external_setup_required.length,
    incomplete_exit_criteria: exitCriteria.filter((criterion) => criterion.complete !== true).length,
  };
}

export function run(filePath = defaultPlanPath) {
  const plan = loadVercelWebDeploymentPlan(filePath);
  const summary = validateVercelWebDeploymentPlan(plan);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : defaultPlanPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
