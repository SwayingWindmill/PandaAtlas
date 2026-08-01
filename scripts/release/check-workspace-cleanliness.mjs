import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DIAGNOSTIC_COMMANDS = [
  { label: "Tracked repository changes", args: ["status", "--short", "--untracked-files=no"] },
  { label: "Modified tracked files", args: ["ls-files", "--modified"] },
  { label: "Whitespace errors", args: ["diff", "--check", "--ignore-submodules", "--"] },
  { label: "Diff summary", args: ["diff", "--summary", "--ignore-submodules", "--"] },
  { label: "Changed paths", args: ["diff", "--name-status", "--ignore-submodules", "--"] },
  { label: "Raw diff metadata", args: ["diff", "--raw", "--ignore-submodules", "--"] },
  { label: "Tracked diff", args: ["diff", "--no-ext-diff", "--binary", "--ignore-submodules", "--"] },
];

function runGit(args, { cwd, runner }) {
  const result = runner("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    throw new Error(`Unable to run git ${args.join(" ")}: ${result.error.message}`);
  }
  return result;
}

function commandText(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.trimEnd();
}

export class WorkspaceCleanlinessError extends Error {
  constructor({ context, diagnostics }) {
    super(`${context} modified tracked repository files`);
    this.name = "WorkspaceCleanlinessError";
    this.context = context;
    this.diagnostics = diagnostics;
  }
}

export function inspectTrackedWorkspace({
  cwd = process.cwd(),
  runner = spawnSync,
} = {}) {
  const check = runGit(["diff", "--quiet", "--ignore-submodules", "--"], { cwd, runner });
  if (check.status === 0) {
    return { clean: true, diagnostics: [] };
  }
  if (check.status !== 1) {
    throw new Error(
      `Unable to inspect tracked workspace cleanliness (git exit ${check.status ?? "unknown"}): ${commandText(check)}`,
    );
  }

  const diagnostics = DIAGNOSTIC_COMMANDS.map(({ label, args }) => {
    const result = runGit(args, { cwd, runner });
    return {
      label,
      command: `git ${args.join(" ")}`,
      status: result.status,
      output: commandText(result),
    };
  });
  return { clean: false, diagnostics };
}

export function renderWorkspaceDiagnostics({ context, diagnostics }) {
  const lines = [`Workspace cleanliness failed: ${context}`];
  for (const diagnostic of diagnostics) {
    lines.push("", `## ${diagnostic.label}`, `$ ${diagnostic.command}`);
    lines.push(diagnostic.output || "(no output)");
  }
  return lines.join("\n");
}

export function assertTrackedWorkspaceClean({
  context = "release-certification",
  cwd = process.cwd(),
  runner = spawnSync,
  logger = console,
  githubActions = process.env.GITHUB_ACTIONS === "true",
} = {}) {
  const result = inspectTrackedWorkspace({ cwd, runner });
  if (result.clean) {
    logger.log(`[workspace-cleanliness] clean context=${context}`);
    return result;
  }

  const rendered = renderWorkspaceDiagnostics({ context, diagnostics: result.diagnostics });
  if (githubActions) logger.error("::group::Tracked repository changes");
  logger.error(rendered);
  if (githubActions) {
    logger.error("::endgroup::");
    logger.error(`::error title=Workspace cleanliness::${context} modified tracked files.`);
  }
  throw new WorkspaceCleanlinessError({ context, diagnostics: result.diagnostics });
}

function parseContext(argv) {
  const contextIndex = argv.indexOf("--context");
  if (contextIndex === -1) return "release-certification";
  const context = argv[contextIndex + 1];
  if (!context) throw new Error("--context requires a value");
  return context;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertTrackedWorkspaceClean({ context: parseContext(process.argv.slice(2)) });
  } catch (error) {
    if (!(error instanceof WorkspaceCleanlinessError)) {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  }
}
