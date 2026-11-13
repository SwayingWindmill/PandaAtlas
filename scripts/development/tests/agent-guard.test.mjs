import assert from "node:assert/strict";
import { test } from "node:test";

import { blockedReason } from "../agent-guard.mjs";

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
  ]) {
    assert.equal(blockedReason(command), null, command);
  }
});
