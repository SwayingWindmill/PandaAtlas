import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { blockedReason, evaluatePreToolPayload } from "../agent-guard.mjs";

const guardScript = fileURLToPath(new URL("../agent-guard.mjs", import.meta.url));

test("blocks git stash run as a command", () => {
  for (const command of [
    "git stash",
    "git stash pop",
    "cd /e/Code/PandaAtlas && git stash list",
    'git -C "E:/Code/PandaAtlas" stash push -m x',
    'git -c "user.name=a b" stash',
    "git --no-pager stash list",
    "git.exe stash",
    "& git stash",
    "git status; git stash",
    "if true; then git stash; fi",
    "for x in a; do git stash; done",
    "try { git stash } catch {}",
    "FOO=1 git stash",
    "env git stash",
    "git -p stash list",
    "GIT stash",
  ]) {
    assert.ok(blockedReason(command), command);
  }
});

test("leaves other git commands and quoted mentions of git stash alone", () => {
  for (const command of [
    "git status",
    'git commit -m "docs: never git stash"',
    'rg -n "git stash" AGENTS.md',
    "grep -rn stash src",
    "git log --grep=stash",
    'git commit -m "docs: then git stash"',
    'git commit -m "else git stash is bad"',
    "git commit -m 'what to do git stash list'",
    'gh pr create --body "Never run git stash, then pop it"',
    'rg "do git stash"',
    'echo "Do Git Stash"',
  ]) {
    assert.equal(blockedReason(command), null, command);
  }
});

test("evaluates Antigravity and Claude Code PreToolUse payloads", () => {
  assert.equal(
    evaluatePreToolPayload({ toolCall: { name: "run_command", args: { CommandLine: "git stash" } } }, "agy").decision,
    "deny",
  );
  assert.equal(
    evaluatePreToolPayload({ toolCall: { name: "run_command", args: { command: "git stash pop" } } }, "agy").decision,
    "deny",
  );
  assert.deepEqual(
    evaluatePreToolPayload({ toolCall: { name: "run_command", args: { CommandLine: "git status" } } }, "agy"),
    { decision: "allow" },
  );
  assert.deepEqual(
    evaluatePreToolPayload({ toolCall: { name: "read_file", args: { CommandLine: "git stash" } } }, "agy"),
    { decision: "allow" },
  );
  assert.equal(
    evaluatePreToolPayload({ tool_input: { command: "git stash" } }, "claude").decision,
    "deny",
  );
  assert.deepEqual(evaluatePreToolPayload({ tool_input: { command: "git status" } }, "claude"), {
    decision: "allow",
  });
  assert.deepEqual(evaluatePreToolPayload(null, "agy"), { decision: "allow" });
});

test("CLI respects --runtime=agy JSON stdout and --runtime=claude exit code 2 contracts", () => {
  const agyDeny = spawnSync(process.execPath, [guardScript, "--runtime=agy"], {
    input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "git stash" } } }),
    encoding: "utf8",
  });
  assert.equal(agyDeny.status, 0);
  assert.equal(JSON.parse(agyDeny.stdout).decision, "deny");

  const agyAllow = spawnSync(process.execPath, [guardScript, "--runtime=agy"], {
    input: JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "git status" } } }),
    encoding: "utf8",
  });
  assert.equal(agyAllow.status, 0);
  assert.deepEqual(JSON.parse(agyAllow.stdout), { decision: "allow" });

  const claudeDeny = spawnSync(process.execPath, [guardScript, "--runtime=claude"], {
    input: JSON.stringify({ tool_input: { command: "git stash" } }),
    encoding: "utf8",
  });
  assert.equal(claudeDeny.status, 2);
  assert.match(claudeDeny.stderr, /git stash is blocked/);

  const claudeBadJson = spawnSync(process.execPath, [guardScript, "--runtime=claude"], {
    input: "not-json",
    encoding: "utf8",
  });
  assert.equal(claudeBadJson.status, 0);

  const agyBomDeny = spawnSync(process.execPath, [guardScript, "--runtime=agy"], {
    input: `\uFEFF${JSON.stringify({ toolCall: { name: "run_command", args: { CommandLine: "git stash" } } })}\r\n`,
    encoding: "utf8",
  });
  assert.equal(agyBomDeny.status, 0);
  assert.equal(JSON.parse(agyBomDeny.stdout).decision, "deny");
});
