import assert from "node:assert/strict";
import { test } from "node:test";

import { blockedReason } from "../agent-guard.mjs";

test("blocks every form of git stash", () => {
  for (const command of [
    "git stash",
    "git stash pop",
    "cd /e/Code/PandaAtlas && git stash list",
    'git -C "E:/Code/PandaAtlas" stash push -m x',
    "git -c core.autocrlf=false stash",
  ]) {
    assert.ok(blockedReason(command), command);
  }
});

test("lets other git commands and the word stash elsewhere through", () => {
  for (const command of ["git status", 'git commit -m "stash the panda photos"', "grep -rn stash src", "git log --grep=stash"]) {
    assert.equal(blockedReason(command), null, command);
  }
});
