import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..", "..");

function quoteWindowsArgument(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function windowsCommandLine(command, args) {
  return [command, ...args].map(quoteWindowsArgument).join(" ");
}

export function resolveCommandInvocation(
  command,
  args,
  {
    platform = process.platform,
    npmExecPath = process.env.npm_execpath,
    nodeExecutable = process.execPath,
    shell = false,
    comSpec = process.env.ComSpec ?? "cmd.exe",
    requireNpmExecPath = false,
  } = {},
) {
  if (platform === "win32" && ["npm", "npx"].includes(command)) {
    if (npmExecPath) {
      const npmBinDirectory = path.win32.dirname(npmExecPath);
      const cliPath =
        command === "npm" ? npmExecPath : path.win32.join(npmBinDirectory, "npx-cli.js");
      return {
        executable: nodeExecutable,
        args: [cliPath, ...args],
        shell: false,
      };
    }
    if (requireNpmExecPath) {
      throw new Error(
        `Development command ${command} requires npm_execpath on Windows; run it through npm run ops`,
      );
    }
    return {
      executable: comSpec,
      args: ["/d", "/s", "/c", windowsCommandLine(command, args)],
      shell: false,
    };
  }
  return {
    executable: command,
    args,
    shell: Boolean(shell),
  };
}

export async function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const env = { ...process.env, ...options.env };
  console.log(`\n> ${[command, ...args].join(" ")}`);

  const invocation = resolveCommandInvocation(command, args, { shell: options.shell });
  await new Promise((resolve, reject) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd,
      env,
      shell: invocation.shell,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) return resolve(undefined);
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`));
    });
  });
}
