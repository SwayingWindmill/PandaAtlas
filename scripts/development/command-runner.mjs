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

export async function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? repoRoot;
  const env = { ...process.env, ...options.env };
  console.log(`\n> ${[command, ...args].join(" ")}`);

  await new Promise((resolve, reject) => {
    const useCommandProcessor = process.platform === "win32" && command === "npm";
    const executable = useCommandProcessor ? process.env.ComSpec ?? "cmd.exe" : command;
    const executableArgs = useCommandProcessor
      ? ["/d", "/s", "/c", windowsCommandLine(command, args)]
      : args;
    const child = spawn(executable, executableArgs, { cwd, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) return resolve(undefined);
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`));
    });
  });
}
