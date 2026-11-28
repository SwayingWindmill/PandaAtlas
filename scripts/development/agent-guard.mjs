// Shared PreToolUse guard for Claude Code and Antigravity.
// Claude Code exits 2 on block and writes the reason to stderr; Antigravity writes a JSON verdict to stdout.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// All worktrees share one stash list, so a stash or pop can take another session's changes.
// Only a git invocation at the start of a command counts, so "git stash" quoted in a commit
// message or a search pattern is left alone.
const GIT_STASH =
  /(?:^|[;&|\n({])\s*(?:(?:then|do|else)\s+)?(?:(?:[A-Za-z_]\w*=\S*|env|command|time)\s+)*git(?:\.exe)?(?:\s+(?:-[Cc]\s+(?:"[^"]*"|'[^']*'|\S+)|-[pP]|--[\w-]+(?:=\S+)?))*\s+stash\b/i;

export function blockedReason(command) {
  if (GIT_STASH.test(command)) {
    return "git stash is blocked in PandaAtlas: every worktree shares one stash list. Commit to your own branch instead.";
  }
  return null;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function evaluatePreToolPayload(payload, runtime = "claude") {
  if (!isPlainObject(payload)) {
    return { decision: "allow" };
  }

  if (runtime === "agy") {
    const toolCall = payload.toolCall;
    if (!isPlainObject(toolCall)) {
      return { decision: "allow" };
    }
    const toolName = typeof toolCall.name === "string" ? toolCall.name.toLowerCase() : "";
    if (toolName !== "run_command") {
      return { decision: "allow" };
    }
    const args = toolCall.args;
    const command = isPlainObject(args) ? String(args.CommandLine ?? args.command ?? "") : "";
    const reason = blockedReason(command);
    return reason ? { decision: "deny", reason } : { decision: "allow" };
  }

  const toolInput = payload.tool_input;
  const command = isPlainObject(toolInput) ? String(toolInput.command ?? "") : "";
  const reason = blockedReason(command);
  return reason ? { decision: "deny", reason } : { decision: "allow" };
}

function parseRuntimeArg(argv) {
  const arg = argv.find((item) => item.startsWith("--runtime="));
  return arg?.slice("--runtime=".length) === "agy" ? "agy" : "claude";
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const runtime = parseRuntimeArg(process.argv.slice(2));
  let rawInput = "";
  try {
    rawInput = readFileSync(0, "utf8");
  } catch {
    rawInput = "";
  }

  let payload = null;
  const trimmedInput = rawInput.replace(/^\uFEFF/, "").trim();
  if (trimmedInput) {
    try {
      payload = JSON.parse(trimmedInput);
    } catch {
      payload = null;
    }
  }

  const verdict = evaluatePreToolPayload(payload, runtime);
  if (runtime === "agy") {
    process.stdout.write(`${JSON.stringify(verdict)}\n`);
  } else if (verdict.decision === "deny") {
    process.stderr.write(`${verdict.reason}\n`);
    process.exit(2);
  }
}
