import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const wranglerCli = path.join(
  repositoryRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);
const defaultMigrationsDirectory = path.join(
  repositoryRoot,
  "infra",
  "cloudflare",
  "d1",
  "migrations",
);

export function listMigrationFileNames(migrationsDirectory = defaultMigrationsDirectory) {
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function quoteSqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildAtomicMigrationSql(migrationName, migrationSql) {
  if (!/^[A-Za-z0-9._-]+\.sql$/.test(migrationName)) {
    throw new Error(`Unsafe D1 migration file name: ${migrationName}`);
  }

  const normalizedSql = migrationSql.replaceAll("\r\n", "\n").trimEnd();
  const quotedName = quoteSqlLiteral(migrationName);
  return `${normalizedSql}\n\ninsert into d1_migrations (name)\nselect ${quotedName}\nwhere not exists (select 1 from d1_migrations where name = ${quotedName});\n`;
}

export function appliedMigrationNamesFromWranglerJson(stdout) {
  const payload = JSON.parse(stdout);
  if (!Array.isArray(payload) || payload.some((item) => item?.success !== true)) {
    throw new Error("Wrangler did not return a successful D1 query result.");
  }

  return new Set(
    payload.flatMap((item) => item.results ?? [])
      .map((row) => row.name)
      .filter((name) => typeof name === "string"),
  );
}

function parseArguments(argv) {
  const options = {
    database: null,
    config: null,
    migrationsDirectory: defaultMigrationsDirectory,
    target: null,
    persistTo: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    switch (argument) {
      case "--database":
        options.database = value;
        index += 1;
        break;
      case "--config":
        options.config = path.resolve(repositoryRoot, value);
        index += 1;
        break;
      case "--migrations-dir":
        options.migrationsDirectory = path.resolve(repositoryRoot, value);
        index += 1;
        break;
      case "--persist-to":
        options.persistTo = path.resolve(repositoryRoot, value);
        index += 1;
        break;
      case "--remote":
      case "--local":
      case "--preview":
        if (options.target) throw new Error("Choose exactly one D1 target.");
        options.target = argument;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.database) throw new Error("--database is required.");
  if (!options.target) throw new Error("Choose --remote, --local, or --preview.");
  if (options.target === "--local" && !options.persistTo) {
    throw new Error("--persist-to is required with --local.");
  }
  return options;
}

function wranglerExecuteArguments(options, executionArguments) {
  const args = ["wrangler", "d1", "execute", options.database];
  if (options.config) args.push("--config", options.config);
  args.push(options.target);
  if (options.persistTo) args.push("--persist-to", options.persistTo);
  args.push(...executionArguments);
  return args;
}

function runWrangler(options, executionArguments, { capture = false } = {}) {
  const result = spawnSync(
    process.execPath,
    [wranglerCli, ...wranglerExecuteArguments(options, executionArguments).slice(1)],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler exited with status ${result.status}.`);
  }
  return result.stdout ?? "";
}

function ensureMigrationTable(options) {
  runWrangler(options, [
    "--command",
    "create table if not exists d1_migrations (id integer primary key autoincrement, name text, applied_at timestamp not null default current_timestamp)",
    "--yes",
  ]);
}

function readAppliedMigrationNames(options) {
  const stdout = runWrangler(options, [
    "--command",
    "select name from d1_migrations order by id",
    "--json",
  ], { capture: true });
  return appliedMigrationNamesFromWranglerJson(stdout);
}

export function pendingMigrationFileNames(allMigrationNames, appliedMigrationNames) {
  return allMigrationNames.filter((name) => !appliedMigrationNames.has(name));
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  ensureMigrationTable(options);

  const allMigrationNames = listMigrationFileNames(options.migrationsDirectory);
  const appliedBefore = readAppliedMigrationNames(options);
  const pendingNames = pendingMigrationFileNames(allMigrationNames, appliedBefore);
  if (pendingNames.length === 0) {
    console.log("[d1-migrations] no pending migrations");
    return;
  }

  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "pandaatlas-d1-"));
  try {
    for (const migrationName of pendingNames) {
      const sourcePath = path.join(options.migrationsDirectory, migrationName);
      const temporaryPath = path.join(temporaryDirectory, migrationName);
      const atomicSql = buildAtomicMigrationSql(
        migrationName,
        readFileSync(sourcePath, "utf8"),
      );
      writeFileSync(temporaryPath, atomicSql, "utf8");
      console.log(`[d1-migrations] applying ${migrationName}`);
      runWrangler(options, ["--file", temporaryPath, "--yes"]);
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  const appliedAfter = readAppliedMigrationNames(options);
  const missingNames = allMigrationNames.filter((name) => !appliedAfter.has(name));
  if (missingNames.length > 0) {
    throw new Error(`D1 migration verification failed: ${missingNames.join(", ")}`);
  }
  console.log(`[d1-migrations] applied ${pendingNames.length} migration(s)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
