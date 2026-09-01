import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEVELOPMENT_SCOPE_COMMAND_IDS,
  DEVELOPMENT_SCOPE_ORDER,
  commandsForDevelopmentScope,
  getDevelopmentCommand,
  listDevelopmentCommands,
} from "../catalog.mjs";
import {
  renderDevelopmentCommand,
  resolveDevelopmentInvocation,
} from "../operations.mjs";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

test("Development Operations catalog has unique, complete commands", () => {
  const commands = listDevelopmentCommands();
  assert.equal(new Set(commands.map((command) => command.id)).size, commands.length);
  for (const command of commands) {
    assert.ok(command.category);
    assert.ok(command.description);
    assert.ok(command.command);
    assert.ok(Array.isArray(command.args));
    assert.ok(Array.isArray(command.requires));
    assert.ok(command.effect);
  }
});

test("development verification scopes resolve through the shared catalog", () => {
  assert.deepEqual(Object.keys(DEVELOPMENT_SCOPE_COMMAND_IDS), DEVELOPMENT_SCOPE_ORDER);
  for (const scope of DEVELOPMENT_SCOPE_ORDER) {
    const commands = commandsForDevelopmentScope(scope);
    assert.deepEqual(
      commands.map((command) => command.id),
      DEVELOPMENT_SCOPE_COMMAND_IDS[scope],
    );
    for (const command of commands) {
      assert.deepEqual(command, getDevelopmentCommand(command.id));
    }
  }
});

test("command rendering exposes the executable interface", () => {
  assert.equal(renderDevelopmentCommand(getDevelopmentCommand("web.lint")), "npm run lint -w web");
  assert.equal(
    renderDevelopmentCommand(getDevelopmentCommand("api.test")),
    "npm run test -w @zhipanda/api",
  );
});

test("Windows npm and npx commands run through the Node CLI without a shell", () => {
  const npmExecPath = "C:\\node\\node_modules\\npm\\bin\\npm-cli.js";
  const nodeExecutable = "C:\\node\\node.exe";
  assert.deepEqual(
    resolveDevelopmentInvocation("npm", ["run", "typecheck", "-w", "web"], {
      platform: "win32",
      npmExecPath,
      nodeExecutable,
      shell: true,
    }),
    {
      executable: nodeExecutable,
      args: [npmExecPath, "run", "typecheck", "-w", "web"],
      shell: false,
    },
  );
  assert.deepEqual(
    resolveDevelopmentInvocation("npx", ["supabase", "--version"], {
      platform: "win32",
      npmExecPath,
      nodeExecutable,
    }),
    {
      executable: nodeExecutable,
      args: ["C:\\node\\node_modules\\npm\\bin\\npx-cli.js", "supabase", "--version"],
      shell: false,
    },
  );
  assert.throws(
    () =>
      resolveDevelopmentInvocation("npm", ["run", "lint"], {
        platform: "win32",
        npmExecPath: "",
        nodeExecutable,
      }),
    /requires npm_execpath/,
  );
});

test("operations CLI lists and describes catalog commands", () => {
  const cliPath = path.join(repoRoot, "scripts", "development", "operations.mjs");
  const listed = spawnSync(process.execPath, [cliPath, "list", "--category", "runtime"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /web\.dev/);
  assert.match(listed.stdout, /api\.dev/);
  assert.doesNotMatch(listed.stdout, /worker\./);

  const described = spawnSync(process.execPath, [cliPath, "describe", "verify.dev", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(described.status, 0, described.stderr);
  const payload = JSON.parse(described.stdout);
  assert.equal(payload.id, "verify.dev");
  assert.equal(payload.category, "verification");
});

test("root package exposes the current canonical development interface", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.ops, "node scripts/development/operations.mjs");
  assert.equal(
    packageJson.scripts["dev:web"],
    "node scripts/development/operations.mjs run web.dev",
  );
  assert.equal(packageJson.scripts["dev:api"], "npm run dev -w @zhipanda/api");
  assert.equal(
    packageJson.scripts["verify:dev"],
    "node scripts/development/operations.mjs run verify.dev",
  );
  assert.equal(
    packageJson.scripts["check:repository-hygiene"],
    "node scripts/development/operations.mjs run release.check-repository-hygiene",
  );
  assert.equal(
    packageJson.scripts["check:research-script-policy"],
    "node scripts/development/operations.mjs run release.check-research-script-policy",
  );
  assert.equal(
    packageJson.scripts["check:batch-workflow-interface"],
    "node scripts/development/operations.mjs run release.check-batch-workflow-interface",
  );
  assert.equal(packageJson.scripts["batch:plan"], "node scripts/batch/operations.mjs plan");
  assert.equal(packageJson.scripts["batch:run"], "node scripts/batch/operations.mjs run --execute");
  assert.equal(
    packageJson.scripts["infra:status"],
    "node scripts/development/operations.mjs run foundation.status",
  );
  assert.equal(packageJson.scripts["check:delivery-contract"], undefined);
  assert.equal(packageJson.scripts["check:repository-structure"], undefined);
  assert.equal(packageJson.scripts["check:api-runtime-boundary"], undefined);
  assert.equal(packageJson.scripts["deploy:api:cf"], undefined);
});
