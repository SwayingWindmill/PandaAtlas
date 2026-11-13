// Claude Code PreToolUse hook for the Bash and PowerShell tools. Exit code 2 blocks the call and
// hands stderr back to the agent.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// All worktrees share one stash list, so a stash or pop can take another session's changes.
// Only a git invocation at the start of a command counts, so "git stash" quoted in a commit
// message or a search pattern is left alone.
const GIT_STASH =
  /(?:^|[;&|\n(])\s*git(?:\.exe)?(?:\s+(?:-[Cc]\s+(?:"[^"]*"|'[^']*'|\S+)|--[\w-]+(?:=\S+)?))*\s+stash\b/;

export function blockedReason(command) {
  if (GIT_STASH.test(command)) {
    return "git stash is blocked in PandaAtlas: every worktree shares one stash list. Commit to your own branch instead.";
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const reason = blockedReason(String(input.tool_input?.command ?? ""));
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}
