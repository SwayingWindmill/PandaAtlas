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
  resolveDevelopmentSpawn,
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
  assert.match(renderDevelopmentCommand(getDevelopmentCommand("api.test")), /uv run/);
});

test("Windows npm and npx commands use the command processor", () => {
  const comSpec = "C:\\Windows\\System32\\cmd.exe";
  const npm = resolveDevelopmentSpawn(getDevelopmentCommand("web.lint"), ["--fix"], {
    platform: "win32",
    comSpec,
  });
  assert.equal(npm.executable, comSpec);
  assert.deepEqual(npm.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.equal(npm.args[3], "npm run lint -w web --fix");
  assert.equal(npm.shell, false);

  const npx = resolveDevelopmentSpawn(getDevelopmentCommand("foundation.status"), [], {
    platform: "win32",
    comSpec,
  });
  assert.equal(npx.executable, comSpec);
  assert.match(npx.args[3], /^npx --yes supabase@2\.110\.0 status --workdir infra$/);

  const posix = resolveDevelopmentSpawn(getDevelopmentCommand("web.lint"), [], {
    platform: "linux",
  });
  assert.equal(posix.executable, "npm");
  assert.deepEqual(posix.args, ["run", "lint", "-w", "web"]);
  assert.equal(posix.shell, false);
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

  const described = spawnSync(process.execPath, [cliPath, "describe", "verify.dev", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(described.status, 0, described.stderr);
  const payload = JSON.parse(described.stdout);
  assert.equal(payload.id, "verify.dev");
  assert.equal(payload.category, "verification");
});

test("root package exposes one canonical interface and compatibility adapters", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.ops, "node scripts/development/operations.mjs");
  assert.equal(
    packageJson.scripts["dev:web"],
    "node scripts/development/operations.mjs run web.dev",
  );
  assert.equal(
    packageJson.scripts["verify:dev"],
    "node scripts/development/operations.mjs run verify.dev",
  );
  assert.equal(
    packageJson.scripts["infra:status"],
    "node scripts/development/operations.mjs run foundation.status",
  );
});
