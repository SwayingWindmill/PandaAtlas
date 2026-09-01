import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export const DEVELOPMENT_SCOPE_ORDER = [
  "release",
  "web",
  "api",
  "curation",
  "data",
];

const commands = [
  {
    id: "codegraph.init",
    category: "navigation",
    description: "Initialize the local CodeGraph index.",
    command: "node",
    args: ["scripts/codegraph.mjs", "init", "."],
    requires: ["node"],
    effect: "local-state",
  },
  {
    id: "codegraph.index",
    category: "navigation",
    description: "Rebuild the local CodeGraph index.",
    command: "node",
    args: ["scripts/codegraph.mjs", "index", "."],
    requires: ["node"],
    effect: "local-state",
  },
  {
    id: "codegraph.sync",
    category: "navigation",
    description: "Synchronize the local CodeGraph index with the worktree.",
    command: "node",
    args: ["scripts/codegraph.mjs", "sync", "."],
    requires: ["node"],
    effect: "local-state",
  },
  {
    id: "codegraph.status",
    category: "navigation",
    description: "Show local CodeGraph health.",
    command: "node",
    args: ["scripts/codegraph.mjs", "status", "."],
    requires: ["node"],
    effect: "read-only",
  },
  {
    id: "codegraph.query",
    category: "navigation",
    description: "Run a CodeGraph query; append query arguments after the command ID.",
    command: "node",
    args: ["scripts/codegraph.mjs", "query"],
    requires: ["node"],
    effect: "read-only",
  },
  {
    id: "web.dev",
    category: "runtime",
    description: "Start the Next.js development runtime.",
    command: "npm",
    args: ["run", "dev", "-w", "web"],
    requires: ["node_modules"],
    effect: "long-running",
  },
  {
    id: "web.lint",
    category: "verification",
    description: "Run frontend policy, architecture, and ESLint checks.",
    command: "npm",
    args: ["run", "lint", "-w", "web"],
    requires: ["node_modules"],
    effect: "read-only",
  },
  {
    id: "web.typecheck",
    category: "verification",
    description: "Run the frontend TypeScript check.",
    command: "npm",
    args: ["run", "typecheck", "-w", "web"],
    requires: ["node_modules"],
    effect: "read-only",
  },
  {
    id: "web.build",
    category: "verification",
    description: "Build the production Next.js application.",
    command: "npm",
    args: ["run", "build", "-w", "web"],
    requires: ["node_modules"],
    effect: "generated-output",
  },
  {
    id: "web.smoke",
    category: "verification",
    description: "Run frontend Playwright smoke tests.",
    command: "npm",
    args: ["run", "smoke", "-w", "web"],
    requires: ["node_modules", "playwright"],
    effect: "generated-output",
  },
  {
    id: "web.smoke-matrix",
    category: "verification",
    description: "Run the frontend browser matrix.",
    command: "npm",
    args: ["run", "smoke:matrix", "-w", "web"],
    requires: ["node_modules", "playwright"],
    effect: "generated-output",
  },
  {
    id: "api.dev",
    category: "runtime",
    description: "Start the NestJS API development runtime.",
    command: "npm",
    args: ["run", "dev", "-w", "@zhipanda/api"],
    requires: ["node_modules"],
    effect: "long-running",
  },
  {
    id: "api.lint",
    category: "verification",
    description: "Run NestJS API lint checks.",
    command: "npm",
    args: ["run", "lint", "-w", "@zhipanda/api"],
    requires: ["node_modules"],
    effect: "read-only",
  },
  {
    id: "api.typecheck",
    category: "verification",
    description: "Run the NestJS API TypeScript check.",
    command: "npm",
    args: ["run", "typecheck", "-w", "@zhipanda/api"],
    requires: ["node_modules"],
    effect: "read-only",
  },
  {
    id: "api.test",
    category: "verification",
    description: "Run the NestJS API Vitest suite.",
    command: "npm",
    args: ["run", "test", "-w", "@zhipanda/api"],
    requires: ["node_modules"],
    effect: "generated-output",
  },
  {
    id: "api.build",
    category: "build",
    description: "Build the NestJS API for Vercel.",
    command: "npm",
    args: ["run", "build:local", "-w", "@zhipanda/api"],
    requires: ["node_modules"],
    effect: "generated-output",
  },
  {
    id: "curation.check",
    category: "verification",
    description: "Validate panda curation records.",
    command: "python",
    args: ["scripts/curation/validate_panda_curation.py"],
    requires: ["python"],
    effect: "read-only",
  },
  {
    id: "curation.test",
    category: "verification",
    description: "Run bounded panda curation tests.",
    command: "python",
    args: [
      "-m",
      "unittest",
      "discover",
      "-s",
      "scripts/curation/tests",
      "-p",
      "test_validate_panda_curation.py",
    ],
    requires: ["python"],
    effect: "generated-output",
  },
  {
    id: "curation.media-test",
    category: "verification",
    description: "Run panda-data media-processing tests.",
    command: "uv",
    args: ["run", "--isolated", "--directory", "tools/panda-data", "--frozen", "--extra", "dev", "--extra", "media", "pytest", "-q", "tests/test_media_processing.py"],
    requires: ["python", "uv"],
    effect: "generated-output",
  },
  {
    id: "data.check",
    category: "verification",
    description: "Validate the Golden Dataset contract.",
    command: "node",
    args: ["scripts/golden-dataset/validate.mjs"],
    requires: ["node"],
    effect: "read-only",
  },
  {
    id: "data.test",
    category: "verification",
    description: "Run Golden Dataset contract tests.",
    command: "node",
    args: ["--test", "scripts/golden-dataset/tests/*.test.mjs"],
    requires: ["node"],
    effect: "generated-output",
    shell: true,
  },
  {
    id: "data.check-identities",
    category: "verification",
    description: "Check generated trusted identity aliases.",
    command: "node",
    args: ["scripts/golden-dataset/generate-web-identity-aliases.mjs", "--check"],
    requires: ["node"],
    effect: "read-only",
  },
  {
    id: "release.check-repository-hygiene",
    category: "verification",
    description: "Reject generated output and accidental duplicate paths from repository input.",
    command: "node",
    args: ["scripts/release/check-repository-hygiene.mjs"],
    requires: ["git", "node"],
    effect: "read-only",
  },
  {
    id: "release.check-research-script-policy",
    category: "verification",
    description: "Enforce reusable research modules and declarative batch manifests.",
    command: "node",
    args: ["scripts/release/check-research-script-policy.mjs"],
    requires: ["git", "node"],
    effect: "read-only",
  },
  {
    id: "release.check-batch-workflow-interface",
    category: "verification",
    description: "Validate bounded batch operation and GitHub Actions safety contracts.",
    command: "node",
    args: ["scripts/release/check-batch-workflow-interface.mjs"],
    requires: ["node"],
    effect: "read-only",
  },
  {
    id: "release.test-development",
    category: "verification",
    description: "Run current development-gate contract tests.",
    command: "node",
    args: [
      "--test",
      "scripts/release/tests/batch-workflow-interface.test.mjs",
      "scripts/release/tests/gate-core.test.mjs",
      "scripts/release/tests/repository-hygiene.test.mjs",
      "scripts/release/tests/research-script-policy.test.mjs",
      "scripts/development/tests/operations.test.mjs",
    ],
    requires: ["node"],
    effect: "generated-output",
  },
  {
    id: "verify.plan",
    category: "verification",
    description: "Print the changed-scope development acceptance plan.",
    command: "node",
    args: ["scripts/release/development.mjs", "--list"],
    requires: ["git", "node"],
    effect: "read-only",
  },
  {
    id: "verify.dev",
    category: "verification",
    description: "Run changed-scope development acceptance.",
    command: "node",
    args: ["scripts/release/development.mjs"],
    requires: ["git", "node"],
    effect: "generated-output",
  },
  {
    id: "foundation.start",
    category: "foundation",
    description: "Start the pinned local Supabase foundation.",
    command: "npx",
    args: ["--yes", "supabase@2.110.0", "start", "--workdir", "infra"],
    requires: ["node", "docker"],
    effect: "local-state",
  },
  {
    id: "foundation.stop",
    category: "foundation",
    description: "Stop the pinned local Supabase foundation.",
    command: "npx",
    args: ["--yes", "supabase@2.110.0", "stop", "--workdir", "infra"],
    requires: ["node", "docker"],
    effect: "local-state",
  },
  {
    id: "foundation.reset",
    category: "foundation",
    description: "Reset local Supabase migrations and seed data.",
    command: "npx",
    args: ["--yes", "supabase@2.110.0", "db", "reset", "--workdir", "infra"],
    requires: ["node", "docker"],
    effect: "destructive-local-state",
  },
  {
    id: "foundation.status",
    category: "foundation",
    description: "Show local Supabase foundation status.",
    command: "npx",
    args: ["--yes", "supabase@2.110.0", "status", "--workdir", "infra"],
    requires: ["node", "docker"],
    effect: "read-only",
  },
];

const commandById = new Map(commands.map((command) => [command.id, command]));
if (commandById.size !== commands.length) {
  throw new Error("Development Operations command IDs must be unique");
}

export const DEVELOPMENT_SCOPE_COMMAND_IDS = Object.freeze({
  release: [
    "release.check-batch-workflow-interface",
    "release.check-research-script-policy",
    "release.test-development",
  ],
  web: ["web.lint", "web.typecheck"],
  api: ["api.lint", "api.typecheck", "api.test"],
  curation: ["curation.test", "curation.check", "curation.media-test"],
  data: ["data.test", "data.check", "data.check-identities"],
});

function copyCommand(command) {
  return {
    ...command,
    args: [...command.args],
    requires: [...command.requires],
  };
}

export function listDevelopmentCommands({ category } = {}) {
  return commands
    .filter((command) => !category || command.category === category)
    .map(copyCommand);
}

export function getDevelopmentCommand(id) {
  const command = commandById.get(id);
  if (!command) {
    throw new Error(`Unknown Development Operations command: ${id}`);
  }
  return copyCommand(command);
}

export function commandsForDevelopmentScope(scope) {
  const ids = DEVELOPMENT_SCOPE_COMMAND_IDS[scope];
  if (!ids) {
    throw new Error(`Unknown development verification scope: ${scope}`);
  }
  return ids.map(getDevelopmentCommand);
}
