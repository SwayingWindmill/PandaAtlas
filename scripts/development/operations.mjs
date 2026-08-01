import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  getDevelopmentCommand,
  listDevelopmentCommands,
  repoRoot,
} from "./catalog.mjs";

function executableForPlatform(command) {
  if (process.platform !== "win32") return command;
  return ["npm", "npx"].includes(command) ? `${command}.cmd` : command;
}

function quote(value) {
  const text = String(value);
  return /[\s"']/u.test(text) ? JSON.stringify(text) : text;
}

export function renderDevelopmentCommand(command) {
  return [command.command, ...command.args].map(quote).join(" ");
}

function usage() {
  return [
    "Development Operations",
    "",
    "Usage:",
    "  npm run ops -- list [--category <name>] [--json]",
    "  npm run ops -- describe <command-id> [--json]",
    "  npm run ops -- run <command-id> [additional arguments]",
    "",
    "Examples:",
    "  npm run ops -- list",
    "  npm run ops -- describe verify.dev",
    "  npm run ops -- run web.dev",
    "  npm run ops -- run verify.dev --scope web",
    "  npm run ops -- run web.smoke tests/smoke/home.spec.ts",
  ].join("\n");
}

function parseListOptions(args) {
  const options = { category: undefined, json: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      options.json = true;
    } else if (argument === "--category") {
      options.category = args[index + 1];
      index += 1;
    } else if (argument.startsWith("--category=")) {
      options.category = argument.slice("--category=".length);
    } else {
      throw new Error(`Unknown list argument: ${argument}`);
    }
  }
  return options;
}

function printList(options) {
  const commands = listDevelopmentCommands({ category: options.category });
  if (options.json) {
    console.log(JSON.stringify(commands, null, 2));
    return;
  }
  if (commands.length === 0) {
    console.log("No Development Operations commands match this category.");
    return;
  }

  let currentCategory;
  for (const command of commands) {
    if (command.category !== currentCategory) {
      currentCategory = command.category;
      console.log(`\n${currentCategory}`);
    }
    console.log(
      `  ${command.id.padEnd(28)} ${command.description} ` +
        `[${command.effect}; ${command.requires.join(", ")}]`,
    );
  }
}

function printDescription(id, json) {
  const command = getDevelopmentCommand(id);
  if (json) {
    console.log(JSON.stringify(command, null, 2));
    return;
  }
  console.log(command.id);
  console.log(`  category: ${command.category}`);
  console.log(`  effect: ${command.effect}`);
  console.log(`  requires: ${command.requires.join(", ")}`);
  console.log(`  command: ${renderDevelopmentCommand(command)}`);
  console.log(`  ${command.description}`);
}

export async function runDevelopmentCommand(id, additionalArgs = []) {
  const command = getDevelopmentCommand(id);
  const executable = executableForPlatform(command.command);
  const args = [...command.args, ...additionalArgs];
  console.log(`[ops] ${id}: ${[command.command, ...args].map(quote).join(" ")}`);

  const status = await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      env: process.env,
      shell: Boolean(command.shell),
      stdio: "inherit",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Development command ${id} stopped by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });

  if (status !== 0) {
    throw new Error(`Development command ${id} failed with exit code ${status}`);
  }
}

export async function runDevelopmentOperations(argv = process.argv.slice(2)) {
  const [action = "help", ...args] = argv;
  if (action === "help" || action === "--help" || action === "-h") {
    console.log(usage());
    return;
  }
  if (action === "list") {
    printList(parseListOptions(args));
    return;
  }
  if (action === "describe") {
    const [id, ...options] = args;
    if (!id) throw new Error("describe requires a command ID");
    if (options.some((option) => option !== "--json")) {
      throw new Error(`Unknown describe argument: ${options.join(" ")}`);
    }
    printDescription(id, options.includes("--json"));
    return;
  }
  if (action === "run") {
    const [id, ...additionalArgs] = args;
    if (!id) throw new Error("run requires a command ID");
    await runDevelopmentCommand(id, additionalArgs);
    return;
  }
  throw new Error(`Unknown Development Operations action: ${action}\n\n${usage()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runDevelopmentOperations().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
