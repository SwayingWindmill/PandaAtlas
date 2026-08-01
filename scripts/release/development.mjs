import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { repoRoot, runCommand } from "./default.mjs";

export const DEVELOPMENT_SCOPE_ORDER = [
  "release",
  "web",
  "worker",
  "api",
  "curation",
  "data",
];

const IGNORED_PREFIXES = [
  ".ai-bridge/",
  ".next/",
  ".release-gate/",
  ".worktrees/",
  "apps/web/.next/",
  "apps/web/.open-next/",
  "apps/web/.wrangler/",
  "apps/web/node_modules/",
  "apps/web/playwright-report/",
  "apps/web/test-results/",
  "node_modules/",
  "services/api/.venv-release/",
  "services/api/.venv/",
  "services/worker-api/node_modules/",
  "test-results/",
];

const SCOPE_COMMANDS = {
  release: [
    {
      id: "release-tests",
      command: "npm",
      args: ["run", "test:development-gate"],
    },
  ],
  web: [
    {
      id: "web-lint",
      command: "npm",
      args: ["run", "lint:web"],
    },
    {
      id: "web-typecheck",
      command: "npm",
      args: ["run", "typecheck:web"],
    },
  ],
  worker: [
    {
      id: "worker-typecheck",
      command: "npm",
      args: ["run", "typecheck:api:cf"],
    },
  ],
  api: [
    {
      id: "api-lint",
      command: "uv",
      args: [
        "run",
        "--directory",
        "services/api",
        "--frozen",
        "--extra",
        "dev",
        "ruff",
        "check",
        "app",
        "tests",
        "scripts",
      ],
    },
    {
      id: "api-tests",
      command: "uv",
      args: [
        "run",
        "--directory",
        "services/api",
        "--frozen",
        "--extra",
        "dev",
        "pytest",
        "-q",
      ],
    },
  ],
  curation: [
    {
      id: "curation-tests",
      command: "npm",
      args: ["run", "test:panda-curation"],
    },
    {
      id: "curation-data",
      command: "npm",
      args: ["run", "check:panda-curation"],
    },
    {
      id: "media-tests",
      command: "npm",
      args: ["run", "test:panda-media"],
    },
  ],
  data: [
    {
      id: "golden-dataset-tests",
      command: "npm",
      args: ["run", "test:golden-dataset"],
    },
    {
      id: "golden-dataset-data",
      command: "npm",
      args: ["run", "check:golden-dataset"],
    },
    {
      id: "trusted-identity-aliases",
      command: "npm",
      args: ["run", "check:trusted-identity-aliases"],
    },
  ],
};

export function normalizeChangedPath(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function isIgnoredChangedPath(changedPath) {
  return (
    IGNORED_PREFIXES.some((prefix) => changedPath.startsWith(prefix)) ||
    changedPath.includes("/__pycache__/") ||
    changedPath.includes("/.pytest_cache/") ||
    changedPath.endsWith(".pyc")
  );
}

function addScope(scopes, scope) {
  if (!DEVELOPMENT_SCOPE_ORDER.includes(scope)) {
    throw new Error(`Unknown development verification scope: ${scope}`);
  }
  scopes.add(scope);
}

function isDocumentationPath(changedPath) {
  return (
    changedPath === "AGENTS.md" ||
    changedPath === "CONTEXT-MAP.md" ||
    changedPath === "README.md" ||
    changedPath === "progress.md" ||
    changedPath === "task_plan.md" ||
    changedPath === "findings.md" ||
    changedPath.startsWith("docs/") ||
    changedPath.endsWith("/CONTEXT.md") ||
    changedPath.endsWith(".md")
  );
}

export function classifyDevelopmentScopes(paths) {
  const scopes = new Set();

  for (const value of paths) {
    const changedPath = normalizeChangedPath(value);
    if (!changedPath || isIgnoredChangedPath(changedPath)) {
      continue;
    }
    if (isDocumentationPath(changedPath)) {
      continue;
    }

    if (changedPath === "package.json") {
      addScope(scopes, "release");
      continue;
    }

    if (changedPath === "package-lock.json") {
      addScope(scopes, "release");
      addScope(scopes, "web");
      addScope(scopes, "worker");
      continue;
    }

    if (
      changedPath.startsWith(".github/workflows/") ||
      changedPath.startsWith("scripts/release/") ||
      changedPath.startsWith("data/beta-launch/") ||
      changedPath.startsWith("data/frontend-evidence/") ||
      changedPath.startsWith("data/frontend-system/") ||
      changedPath.startsWith("data/frontend-withdrawals/") ||
      changedPath.startsWith("contracts/beta-hard-gates") ||
      changedPath.startsWith("contracts/frontend-")
    ) {
      addScope(scopes, "release");
    }

    if (changedPath.startsWith("apps/web/")) {
      addScope(scopes, "web");
    }

    if (changedPath.startsWith("services/worker-api/")) {
      addScope(scopes, "worker");
    }

    if (changedPath.startsWith("services/api/")) {
      addScope(scopes, "api");
    }

    if (
      changedPath === ".dockerignore" ||
      changedPath === "docker-compose.yml" ||
      changedPath.startsWith("deploy/hybrid-production/") ||
      changedPath.startsWith("scripts/deployment/") ||
      changedPath.startsWith("infra/supabase/")
    ) {
      addScope(scopes, "release");
      addScope(scopes, "api");
    }

    if (changedPath.startsWith("infra/cloudflare/")) {
      addScope(scopes, "release");
      addScope(scopes, "worker");
    }

    if (
      changedPath.startsWith("scripts/curation/") ||
      changedPath.startsWith("data/curation/") ||
      changedPath.startsWith("data/media-library/") ||
      changedPath.startsWith("data/reviewed-batches/") ||
      changedPath.startsWith("data/public-releases/") ||
      changedPath.startsWith("data/acquisition-sources/")
    ) {
      addScope(scopes, "curation");
    }

    if (
      changedPath.startsWith("scripts/golden-dataset/") ||
      changedPath.startsWith("contracts/golden-dataset/") ||
      changedPath === "contracts/panda-expansion.v1.json" ||
      changedPath === "contracts/panda-knowledge.v1.json"
    ) {
      addScope(scopes, "data");
    }

    if (
      changedPath.startsWith("contracts/panda-") ||
      changedPath === "contracts/acquisition-bundle.v1.json" ||
      changedPath === "contracts/curation-patch.v1.json" ||
      changedPath === "contracts/curator-decisions.v1.json" ||
      changedPath === "contracts/integration-event.v1.json"
    ) {
      addScope(scopes, "api");
    }

    if (changedPath === "contracts/recovery-drill-environments.v1.json") {
      addScope(scopes, "release");
    }

    if (
      changedPath === "scripts/check-public-api-boundary.mjs" ||
      changedPath === "contracts/public-api-v1.json"
    ) {
      addScope(scopes, "release");
      addScope(scopes, "api");
    }
  }

  return DEVELOPMENT_SCOPE_ORDER.filter((scope) => scopes.has(scope));
}

export function createPlanForScopes(scopes) {
  const selected = new Set(scopes);
  const orderedScopes = DEVELOPMENT_SCOPE_ORDER.filter((scope) => selected.has(scope));

  for (const scope of selected) {
    if (!DEVELOPMENT_SCOPE_ORDER.includes(scope)) {
      throw new Error(`Unknown development verification scope: ${scope}`);
    }
  }

  return {
    scopes: orderedScopes,
    groups: orderedScopes.map((scope) => ({
      scope,
      commands: SCOPE_COMMANDS[scope].map((command) => ({ ...command, args: [...command.args] })),
    })),
  };
}

export function createDevelopmentPlan(paths) {
  return createPlanForScopes(classifyDevelopmentScopes(paths));
}

export function developmentPlanOutputs(plan) {
  const scopes = new Set(plan.scopes);
  const requiresPython = ["api", "curation"].some((scope) => scopes.has(scope));
  const requiresUv = ["api", "curation"].some((scope) => scopes.has(scope));
  const requiresNodeModules = ["web", "worker"].some((scope) => scopes.has(scope));

  return {
    run_checks: plan.groups.length > 0 ? "true" : "false",
    requires_node_modules: requiresNodeModules ? "true" : "false",
    requires_python: requiresPython ? "true" : "false",
    requires_uv: requiresUv ? "true" : "false",
    scopes: plan.scopes.join(","),
  };
}

function gitOutput(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    if (allowFailure) return null;
    throw new Error(`Unable to run git ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(
      `git ${args.join(" ")} failed with code ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }
  return result.stdout ?? "";
}

function outputPaths(output) {
  return String(output ?? "")
    .split(/\r?\n/u)
    .map(normalizeChangedPath)
    .filter(Boolean);
}

function addOutputPaths(changed, output) {
  for (const changedPath of outputPaths(output)) {
    if (!isIgnoredChangedPath(changedPath)) changed.add(changedPath);
  }
}

function resolveBase(explicitBase) {
  const candidate = explicitBase ?? process.env.DEV_GATE_BASE;
  if (!candidate) return null;

  const resolved = gitOutput(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], {
    allowFailure: true,
  });
  if (!resolved) {
    throw new Error(
      `Development verification base does not resolve: ${candidate}. ` +
        "Omit --base to inspect only the current worktree, or provide a valid branch or commit.",
    );
  }
  return candidate;
}

export function collectChangedPaths({ base } = {}) {
  const changed = new Set();
  const resolvedBase = resolveBase(base);

  if (resolvedBase) {
    addOutputPaths(
      changed,
      gitOutput(["diff", "--name-only", "--diff-filter=ACDMRT", `${resolvedBase}...HEAD`]),
    );
  }

  const commands = [
    ["diff", "--name-only", "--diff-filter=ACDMRT"],
    ["diff", "--cached", "--name-only", "--diff-filter=ACDMRT"],
    ["ls-files", "--others", "--exclude-standard"],
  ];

  for (const args of commands) {
    addOutputPaths(changed, gitOutput(args));
  }

  return {
    base: resolvedBase,
    paths: [...changed].sort(),
  };
}

function parseArgs(argv) {
  const options = {
    all: false,
    base: undefined,
    githubOutput: false,
    list: false,
    paths: [],
    scopes: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--all") {
      options.all = true;
    } else if (argument === "--github-output") {
      options.githubOutput = true;
    } else if (argument === "--list") {
      options.list = true;
    } else if (argument === "--base") {
      options.base = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--base=")) {
      options.base = argument.slice("--base=".length);
    } else if (argument === "--scope") {
      options.scopes.push(argv[index + 1]);
      index += 1;
    } else if (argument.startsWith("--scope=")) {
      options.scopes.push(argument.slice("--scope=".length));
    } else if (argument === "--paths") {
      options.paths.push(...String(argv[index + 1] ?? "").split(/[\n,]/u));
      index += 1;
    } else if (argument.startsWith("--paths=")) {
      options.paths.push(...argument.slice("--paths=".length).split(/[\n,]/u));
    } else {
      throw new Error(`Unknown verify:dev argument: ${argument}`);
    }
  }

  return options;
}

function writeGithubOutputs(plan) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("--github-output requires the GITHUB_OUTPUT environment variable");
  }

  const outputs = developmentPlanOutputs(plan);
  const body = Object.entries(outputs)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
  appendFileSync(outputPath, `${body}\n`, "utf8");
  console.log(`[verify:dev] wrote GitHub outputs: ${Object.keys(outputs).join(", ")}`);
}

function printPlan(plan, metadata) {
  console.log("[verify:dev] fast development acceptance");
  if (metadata.base) console.log(`[verify:dev] comparison base: ${metadata.base}`);
  if (metadata.pathCount !== undefined) {
    console.log(`[verify:dev] changed paths considered: ${metadata.pathCount}`);
  }
  console.log(
    `[verify:dev] scopes: ${plan.scopes.length > 0 ? plan.scopes.join(", ") : "none"}`,
  );

  for (const group of plan.groups) {
    for (const command of group.commands) {
      console.log(
        `[verify:dev] ${group.scope}/${command.id}: ${command.command} ${command.args.join(" ")}`,
      );
    }
  }
}

async function runPlan(plan) {
  await Promise.all(
    plan.groups.map(async (group) => {
      console.log(`\n[verify:dev] starting scope=${group.scope}`);
      for (const command of group.commands) {
        await runCommand(command.command, command.args);
      }
      console.log(`[verify:dev] passed scope=${group.scope}`);
    }),
  );
}

export async function runDevelopmentVerification(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  let plan;
  let metadata = {};

  if (options.all) {
    plan = createPlanForScopes(DEVELOPMENT_SCOPE_ORDER);
  } else if (options.scopes.length > 0) {
    plan = createPlanForScopes(options.scopes);
  } else if (options.paths.length > 0) {
    const paths = options.paths.map(normalizeChangedPath).filter(Boolean);
    plan = createDevelopmentPlan(paths);
    metadata = { pathCount: paths.length };
  } else {
    const changed = collectChangedPaths({ base: options.base });
    plan = createDevelopmentPlan(changed.paths);
    metadata = { base: changed.base, pathCount: changed.paths.length };
  }

  printPlan(plan, metadata);
  if (options.githubOutput) writeGithubOutputs(plan);

  if (options.list || plan.groups.length === 0) {
    if (plan.groups.length === 0) {
      console.log(
        "[verify:dev] no executable code checks selected; changes are documentation-only, generated, or outside a governed development scope.",
      );
    }
    return plan;
  }

  await runPlan(plan);
  console.log("\n[verify:dev] all selected development scopes passed");
  return plan;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDevelopmentVerification().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
