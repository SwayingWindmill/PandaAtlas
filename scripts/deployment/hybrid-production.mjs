import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const deploymentDirectory = path.join(repositoryRoot, "deploy", "hybrid-production");
const defaultRuntimeDirectory = path.join(repositoryRoot, ".hybrid-production", "supabase");
const upstreamRepository = "https://github.com/supabase/supabase.git";
const minimumComposeVersion = [2, 24, 4];
const overlayFilename = "docker-compose.zhipanda.yml";
const overlayEnvironmentFilename = "zhipanda.env.example";
const upstreamRefStampFilename = ".zhipanda-supabase-ref";

function parseArguments(argv) {
  const command = argv[0] ?? "help";
  let runtimeDirectory = defaultRuntimeDirectory;
  let force = false;
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--runtime") {
      const value = argv[index + 1];
      if (!value) throw new Error("--runtime requires a path");
      runtimeDirectory = path.resolve(value);
      index += 1;
    } else if (argument === "--force") {
      force = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { command, runtimeDirectory, force };
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return typeof output === "string" ? output.trim() : "";
}

function readPinnedSupabaseRef() {
  const contents = readFileSync(path.join(deploymentDirectory, "supabase.ref"), "utf8");
  const reference = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  if (!reference || !/^[0-9a-f]{40}$/.test(reference)) {
    throw new Error("deploy/hybrid-production/supabase.ref must contain one full commit SHA");
  }
  return reference;
}

function parseEnvironment(contents) {
  const values = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function environmentKeys(contents) {
  return new Set(parseEnvironment(contents).keys());
}

function copyOverlayFiles(runtimeDirectory) {
  cpSync(path.join(deploymentDirectory, overlayFilename), path.join(runtimeDirectory, overlayFilename));
  cpSync(
    path.join(deploymentDirectory, overlayEnvironmentFilename),
    path.join(runtimeDirectory, overlayEnvironmentFilename),
  );
}

function ensureEnvironmentFile(runtimeDirectory) {
  const environmentPath = path.join(runtimeDirectory, ".env");
  const upstreamExamplePath = path.join(runtimeDirectory, ".env.example");
  if (!existsSync(upstreamExamplePath)) {
    throw new Error(`Upstream Supabase environment example is missing: ${upstreamExamplePath}`);
  }
  if (!existsSync(environmentPath)) {
    cpSync(upstreamExamplePath, environmentPath);
  }

  const supplement = readFileSync(path.join(deploymentDirectory, overlayEnvironmentFilename), "utf8");
  const current = readFileSync(environmentPath, "utf8");
  const currentKeys = environmentKeys(current);
  const missingLines = supplement.split(/\r?\n/).filter((line) => {
    const separator = line.indexOf("=");
    if (separator < 1 || line.trimStart().startsWith("#")) return false;
    return !currentKeys.has(line.slice(0, separator).trim());
  });
  if (missingLines.length > 0) {
    appendFileSync(
      environmentPath,
      `\n# ZhiPanda production overlay\n${missingLines.join("\n")}\n`,
      "utf8",
    );
  }
}

function directoryHasEntries(directory) {
  return existsSync(directory) && readdirSync(directory).length > 0;
}

function bootstrap(runtimeDirectory, force) {
  const reference = readPinnedSupabaseRef();
  const stampPath = path.join(runtimeDirectory, upstreamRefStampFilename);
  const environmentPath = path.join(runtimeDirectory, ".env");
  const installedReference = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : null;
  const baseComposeExists = existsSync(path.join(runtimeDirectory, "docker-compose.yml"));
  let preservedEnvironment = null;

  if ((!baseComposeExists || installedReference !== reference) && existsSync(runtimeDirectory)) {
    if (!force) {
      throw new Error(
        `Runtime exists with a different or incomplete Supabase source: ${runtimeDirectory}. ` +
          "Bootstrap a separate runtime for upgrades, or use --force only for an empty failed bootstrap.",
      );
    }
    const persistentPaths = [
      path.join(runtimeDirectory, "volumes", "db", "data"),
      path.join(runtimeDirectory, "volumes", "storage"),
    ];
    if (persistentPaths.some(directoryHasEntries)) {
      throw new Error(
        "Refusing --force because the runtime contains database or Storage data. " +
          "Bootstrap a separate runtime and migrate deliberately.",
      );
    }
    preservedEnvironment = existsSync(environmentPath) ? readFileSync(environmentPath, "utf8") : null;
    rmSync(runtimeDirectory, { recursive: true, force: true });
  }

  if (!existsSync(runtimeDirectory)) {
    const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "zhipanda-supabase-"));
    const sourceDirectory = path.join(temporaryDirectory, "source");
    try {
      run("git", ["clone", "--filter=blob:none", "--no-checkout", upstreamRepository, sourceDirectory]);
      run("git", ["-C", sourceDirectory, "sparse-checkout", "init", "--cone"]);
      run("git", ["-C", sourceDirectory, "sparse-checkout", "set", "docker"]);
      run("git", ["-C", sourceDirectory, "fetch", "--depth", "1", "origin", reference]);
      run("git", ["-C", sourceDirectory, "checkout", "--detach", reference]);
      mkdirSync(runtimeDirectory, { recursive: true });
      cpSync(path.join(sourceDirectory, "docker"), runtimeDirectory, { recursive: true });
      writeFileSync(stampPath, `${reference}\n`, "utf8");
      if (preservedEnvironment !== null) {
        writeFileSync(environmentPath, preservedEnvironment, "utf8");
      }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }

  copyOverlayFiles(runtimeDirectory);
  ensureEnvironmentFile(runtimeDirectory);
  console.log(
    JSON.stringify(
      {
        status: "bootstrapped",
        runtime_directory: runtimeDirectory,
        supabase_ref: reference,
        next_steps: [
          "Edit the generated .env and replace every placeholder.",
          "Run upstream utils/generate-keys.sh --update-env.",
          "Run upstream utils/add-new-auth-keys.sh --update-env.",
          "Configure Cloudflare Tunnel public hostnames and Access policies.",
          "Run npm run hybrid:preflight, then npm run hybrid:up.",
        ],
      },
      null,
      2,
    ),
  );
}

function assertStaticContract(condition, message, failures) {
  if (!condition) failures.push(message);
}

function staticCheck() {
  const failures = [];
  const reference = readPinnedSupabaseRef();
  const compose = readFileSync(path.join(deploymentDirectory, overlayFilename), "utf8");
  const environmentExample = readFileSync(
    path.join(deploymentDirectory, overlayEnvironmentFilename),
    "utf8",
  );
  const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  const gitignore = readFileSync(path.join(repositoryRoot, ".gitignore"), "utf8");
  const dockerignore = readFileSync(path.join(repositoryRoot, ".dockerignore"), "utf8");
  const dockerfile = readFileSync(path.join(repositoryRoot, "services", "api", "Dockerfile"), "utf8");

  assertStaticContract(/^[0-9a-f]{40}$/.test(reference), "Supabase ref is not immutable", failures);
  assertStaticContract(
    compose.includes("cloudflare/cloudflared:2026.7.2"),
    "cloudflared image is not pinned",
    failures,
  );
  assertStaticContract(
    (compose.match(/ports: !override \[\]/g) ?? []).length === 2,
    "Kong and Supavisor host ports must both be removed",
    failures,
  );
  assertStaticContract(
    !/\n  api:[\s\S]*?\n    ports:/m.test(compose),
    "FastAPI must not publish a host port",
    failures,
  );
  assertStaticContract(
    compose.includes("DB_USE_MOCK_FALLBACK: \"false\""),
    "Production API must disable mock fallback",
    failures,
  );
  assertStaticContract(
    compose.includes("scripts/apply_production_migrations.py"),
    "Migration service is missing",
    failures,
  );
  assertStaticContract(
    compose.includes("db-backup:") && compose.includes("storage-backup:"),
    "Database and Storage backup services are required",
    failures,
  );
  assertStaticContract(
    environmentExample.includes("CLOUDFLARE_TUNNEL_TOKEN=[REDACTED_SECRET]"),
    "Tunnel token example must remain redacted",
    failures,
  );
  assertStaticContract(!environmentExample.includes("eyJ"), "A tunnel token appears committed", failures);
  assertStaticContract(gitignore.includes(".hybrid-production/"), "Runtime directory is not ignored", failures);
  assertStaticContract(
    dockerignore.includes("**/.venv") && dockerignore.includes(".hybrid-production"),
    "Docker context does not exclude local environments and production runtime state",
    failures,
  );
  assertStaticContract(
    dockerfile.includes("apply_production_migrations.py") &&
      dockerfile.includes("infra/supabase/migrations"),
    "Production image does not package migration assets",
    failures,
  );
  assertStaticContract(
    /^USER zhipanda$/m.test(dockerfile),
    "Production API and migration containers must run as the dedicated non-root user",
    failures,
  );

  for (const script of [
    "check:hybrid-production",
    "test:hybrid-production",
    "hybrid:bootstrap",
    "hybrid:preflight",
    "hybrid:config",
    "hybrid:up",
    "hybrid:down",
    "hybrid:status",
    "hybrid:backup",
  ]) {
    assertStaticContract(Boolean(packageJson.scripts?.[script]), `Missing npm script: ${script}`, failures);
  }

  if (failures.length > 0) {
    throw new Error(`Hybrid production contract failed:\n- ${failures.join("\n- ")}`);
  }
  const result = {
    status: "passed",
    supabase_ref: reference,
    cloudflared_version: "2026.7.2",
    host_ports_published: 0,
    backup_surfaces: ["postgres", "storage"],
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function isPlaceholder(value) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("[redacted_secret]") ||
    normalized.includes("change-me") ||
    normalized.includes("replace-with") ||
    normalized.includes("your-")
  );
}

function requireEnvironmentValue(values, key, failures) {
  const value = values.get(key) ?? "";
  if (isPlaceholder(value)) failures.push(`${key} is missing or still a placeholder`);
  return value;
}

function requireHttpsUrl(values, key, failures) {
  const value = requireEnvironmentValue(values, key, failures);
  if (!value) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") failures.push(`${key} must use HTTPS`);
    if (["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.hostname.endsWith("example.com")) {
      failures.push(`${key} must use a production hostname`);
    }
  } catch {
    failures.push(`${key} must be a valid URL`);
  }
  return value;
}

function requireLongSecret(values, key, failures) {
  const value = requireEnvironmentValue(values, key, failures);
  if (value && value.length < 32) failures.push(`${key} must contain at least 32 characters`);
  return value;
}

export function validateProductionOrigins(value, key = "CORS_ALLOW_ORIGINS") {
  const failures = [];
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    failures.push(`${key} must contain at least one HTTPS origin`);
    return failures;
  }

  for (const origin of origins) {
    if (origin === "*") {
      failures.push(`${key} must not contain a wildcard origin`);
      continue;
    }
    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.toLowerCase();
      if (parsed.protocol !== "https:") failures.push(`${key} origin must use HTTPS: ${origin}`);
      if (parsed.origin !== origin) {
        failures.push(`${key} entries must be bare origins without path, query, fragment, or trailing slash: ${origin}`);
      }
      if (parsed.username || parsed.password) {
        failures.push(`${key} origins must not contain credentials: ${origin}`);
      }
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "[::1]" ||
        hostname.endsWith(".localhost") ||
        hostname === "example.com" ||
        hostname.endsWith(".example.com")
      ) {
        failures.push(`${key} must use a production hostname: ${origin}`);
      }
    } catch {
      failures.push(`${key} contains an invalid URL: ${origin}`);
    }
  }
  return failures;
}

function preflight(runtimeDirectory) {
  staticCheck();
  const failures = [];
  const environmentPath = path.join(runtimeDirectory, ".env");
  const stampPath = path.join(runtimeDirectory, upstreamRefStampFilename);
  for (const requiredFile of [
    environmentPath,
    path.join(runtimeDirectory, "docker-compose.yml"),
    path.join(runtimeDirectory, overlayFilename),
    stampPath,
  ]) {
    if (!existsSync(requiredFile)) failures.push(`Missing runtime file: ${requiredFile}`);
  }
  if (failures.length > 0) throw new Error(`Hybrid production preflight failed:\n- ${failures.join("\n- ")}`);

  const expectedReference = readPinnedSupabaseRef();
  const installedReference = readFileSync(stampPath, "utf8").trim();
  if (installedReference !== expectedReference) {
    failures.push(`Runtime Supabase ref ${installedReference} does not match ${expectedReference}`);
  }

  const upstreamCompose = readFileSync(path.join(runtimeDirectory, "docker-compose.yml"), "utf8");
  for (const setting of ["GOTRUE_JWT_KEYS", "API_JWT_JWKS", "JWT_JWKS", "SUPABASE_JWKS"]) {
    if (!new RegExp(`^\\s+${setting}:`, "m").test(upstreamCompose)) {
      failures.push(
        `${setting} is not enabled in the generated Supabase Compose file; ` +
          "run utils/add-new-auth-keys.sh --update-env",
      );
    }
  }

  const values = parseEnvironment(readFileSync(environmentPath, "utf8"));
  const publicUrl = requireHttpsUrl(values, "SUPABASE_PUBLIC_URL", failures);
  const authUrl = requireHttpsUrl(values, "API_EXTERNAL_URL", failures);
  requireHttpsUrl(values, "SITE_URL", failures);
  requireEnvironmentValue(values, "ADDITIONAL_REDIRECT_URLS", failures);
  requireEnvironmentValue(values, "POSTGRES_PASSWORD", failures);
  requireEnvironmentValue(values, "DASHBOARD_PASSWORD", failures);
  requireEnvironmentValue(values, "JWT_SECRET", failures);
  requireEnvironmentValue(values, "ANON_KEY", failures);
  requireEnvironmentValue(values, "SERVICE_ROLE_KEY", failures);
  requireEnvironmentValue(values, "SUPABASE_PUBLISHABLE_KEY", failures);
  requireEnvironmentValue(values, "SUPABASE_SECRET_KEY", failures);
  requireEnvironmentValue(values, "ANON_KEY_ASYMMETRIC", failures);
  requireEnvironmentValue(values, "SERVICE_ROLE_KEY_ASYMMETRIC", failures);
  requireEnvironmentValue(values, "JWT_KEYS", failures);
  requireEnvironmentValue(values, "JWT_JWKS", failures);
  const repositoryPath = requireEnvironmentValue(values, "ZHIPANDA_REPO_ROOT", failures);
  const backupPath = requireEnvironmentValue(values, "ZHIPANDA_BACKUP_DIR", failures);
  const tunnelToken = requireLongSecret(values, "CLOUDFLARE_TUNNEL_TOKEN", failures);
  const corsAllowOrigins = requireEnvironmentValue(values, "CORS_ALLOW_ORIGINS", failures);
  failures.push(...validateProductionOrigins(corsAllowOrigins));
  requireHttpsUrl(values, "NOTIFICATION_PUBLIC_BASE_URL", failures);
  const adminToken = requireLongSecret(values, "ADMIN_API_TOKEN", failures);
  const feedSigningKey = requireLongSecret(values, "FEED_CURSOR_SIGNING_KEY", failures);
  const notificationSigningKey = requireLongSecret(
    values,
    "NOTIFICATION_CURSOR_SIGNING_KEY",
    failures,
  );
  const intakeSigningKey = requireLongSecret(
    values,
    "COMMUNITY_INTAKE_STORAGE_SIGNING_KEY",
    failures,
  );

  if (publicUrl && authUrl && authUrl !== `${publicUrl.replace(/\/$/, "")}/auth/v1`) {
    failures.push("API_EXTERNAL_URL must equal SUPABASE_PUBLIC_URL plus /auth/v1");
  }
  if (repositoryPath && (!path.isAbsolute(repositoryPath) || !existsSync(repositoryPath))) {
    failures.push("ZHIPANDA_REPO_ROOT must be an existing absolute path");
  }
  if (backupPath && !path.isAbsolute(backupPath)) {
    failures.push("ZHIPANDA_BACKUP_DIR must be an absolute path");
  }
  if (backupPath && path.isAbsolute(backupPath)) {
    const relativeBackupPath = path.relative(runtimeDirectory, backupPath);
    if (!relativeBackupPath.startsWith("..") && !path.isAbsolute(relativeBackupPath)) {
      failures.push("ZHIPANDA_BACKUP_DIR must be outside the generated Supabase runtime");
    }
  }
  const independentSecrets = [
    tunnelToken,
    adminToken,
    feedSigningKey,
    notificationSigningKey,
    intakeSigningKey,
  ].filter(Boolean);
  if (new Set(independentSecrets).size !== independentSecrets.length) {
    failures.push("Tunnel, administrator, and signing credentials must all be distinct");
  }
  try {
    const actorTokens = JSON.parse(values.get("WORKFLOW_ACTOR_TOKENS_JSON") ?? "{}");
    if (!actorTokens || Array.isArray(actorTokens) || typeof actorTokens !== "object") {
      failures.push("WORKFLOW_ACTOR_TOKENS_JSON must be a JSON object");
    }
  } catch {
    failures.push("WORKFLOW_ACTOR_TOKENS_JSON must be valid JSON");
  }

  if (failures.length > 0) {
    throw new Error(`Hybrid production preflight failed:\n- ${failures.join("\n- ")}`);
  }
  mkdirSync(backupPath, { recursive: true });
  const result = {
    status: "passed",
    runtime_directory: runtimeDirectory,
    supabase_ref: expectedReference,
    public_supabase_origin: publicUrl,
    repository_root: repositoryPath,
    backup_directory: backupPath,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function parseVersion(version) {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Unable to parse Docker Compose version: ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

let composeRuntimeCache;

function requireDockerCompose() {
  if (composeRuntimeCache) return composeRuntimeCache;

  const candidates = [
    { command: "docker", prefix: ["compose"] },
    { command: "docker-compose", prefix: [] },
  ];
  const failures = [];
  for (const candidate of candidates) {
    try {
      const versionText = run(candidate.command, [...candidate.prefix, "version"], { capture: true });
      const version = parseVersion(versionText);
      if (compareVersions(version, minimumComposeVersion) < 0) {
        throw new Error(
          `Docker Compose ${minimumComposeVersion.join(".")} or newer is required for !override; found ${versionText}`,
        );
      }
      composeRuntimeCache = { ...candidate, versionText };
      return composeRuntimeCache;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Docker Compose is unavailable:\n- ${failures.join("\n- ")}`);
}

function composeArguments() {
  return ["--env-file", ".env", "-f", "docker-compose.yml", "-f", overlayFilename];
}

function compose(runtimeDirectory, args, options = {}) {
  const runtime = requireDockerCompose();
  return run(runtime.command, [...runtime.prefix, ...composeArguments(), ...args], {
    cwd: runtimeDirectory,
    capture: options.capture ?? false,
  });
}

function renderComposeConfiguration(runtimeDirectory) {
  const output = compose(
    runtimeDirectory,
    ["--profile", "app", "--profile", "ops", "config", "--format", "json"],
    { capture: true },
  );
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error("Docker Compose did not return valid JSON configuration", { cause: error });
  }
}

function validateRenderedCompose(configuration) {
  const failures = [];
  const services = configuration.services ?? {};
  for (const service of [
    "api",
    "kong",
    "supavisor",
    "cloudflared",
    "migrate",
    "db-backup",
    "storage-backup",
  ]) {
    if (!services[service]) failures.push(`Rendered Compose is missing service: ${service}`);
  }
  for (const service of ["api", "kong", "supavisor", "cloudflared"]) {
    if ((services[service]?.ports ?? []).length > 0) {
      failures.push(`Rendered service publishes host ports: ${service}`);
    }
  }
  if (services.api?.environment?.DB_USE_MOCK_FALLBACK !== "false") {
    failures.push("Rendered FastAPI service does not disable mock fallback");
  }
  if (services.api?.environment?.MIGRATIONS_DIR !== "/app/infra/supabase/migrations") {
    failures.push("Rendered FastAPI migration directory is incorrect");
  }
  if (services.cloudflared?.image !== "cloudflare/cloudflared:2026.7.2") {
    failures.push("Rendered cloudflared image does not match the pinned version");
  }
  for (const service of ["db-backup", "storage-backup"]) {
    if (services[service]?.read_only !== true) {
      failures.push(`Rendered backup service is not read-only: ${service}`);
    }
    if (!JSON.stringify(services[service]?.command ?? "").includes(".partial")) {
      failures.push(`Rendered backup service does not use atomic partial output: ${service}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Rendered hybrid Compose contract failed:\n- ${failures.join("\n- ")}`);
  }
  return Object.keys(services).length;
}

function validateCompose(runtimeDirectory) {
  preflight(runtimeDirectory);
  const composeVersion = requireDockerCompose();
  const configuration = renderComposeConfiguration(runtimeDirectory);
  const serviceCount = validateRenderedCompose(configuration);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        compose_command: [composeVersion.command, ...composeVersion.prefix].join(" "),
        compose_version: composeVersion.versionText,
        rendered_services: serviceCount,
        published_host_ports: 0,
      },
      null,
      2,
    ),
  );
}

function startProduction(runtimeDirectory) {
  preflight(runtimeDirectory);
  requireDockerCompose();
  validateRenderedCompose(renderComposeConfiguration(runtimeDirectory));
  compose(runtimeDirectory, ["up", "-d", "--wait"]);
  compose(runtimeDirectory, ["--profile", "app", "build", "api"]);
  compose(runtimeDirectory, ["--profile", "ops", "run", "--rm", "db-backup"]);
  compose(runtimeDirectory, ["--profile", "ops", "run", "--rm", "migrate"]);
  compose(runtimeDirectory, ["--profile", "app", "up", "-d", "--wait", "api", "cloudflared"]);
  compose(runtimeDirectory, ["--profile", "app", "ps"]);
}

function stopProduction(runtimeDirectory) {
  requireDockerCompose();
  compose(runtimeDirectory, ["--profile", "app", "--profile", "ops", "down"]);
}

function showStatus(runtimeDirectory) {
  requireDockerCompose();
  compose(runtimeDirectory, ["--profile", "app", "--profile", "ops", "ps"]);
}

function showLogs(runtimeDirectory) {
  requireDockerCompose();
  compose(runtimeDirectory, ["--profile", "app", "logs", "--tail", "200"]);
}

function createBackup(runtimeDirectory) {
  preflight(runtimeDirectory);
  requireDockerCompose();
  const runningServices = new Set(
    compose(runtimeDirectory, ["--profile", "app", "ps", "--services", "--status", "running"], {
      capture: true,
    })
      .split(/\r?\n/)
      .map((service) => service.trim())
      .filter(Boolean),
  );
  if (!runningServices.has("db")) {
    throw new Error("The PostgreSQL service must be running before creating a production backup");
  }

  const maintenanceServices = ["cloudflared", "api", "storage", "imgproxy"].filter((service) =>
    runningServices.has(service),
  );
  let backupError;
  if (maintenanceServices.length > 0) {
    compose(runtimeDirectory, ["--profile", "app", "stop", ...maintenanceServices]);
  }
  try {
    compose(runtimeDirectory, ["--profile", "ops", "run", "--rm", "db-backup"]);
    compose(runtimeDirectory, ["--profile", "ops", "run", "--rm", "storage-backup"]);
  } catch (error) {
    backupError = error;
  }

  let restartError;
  if (maintenanceServices.length > 0) {
    try {
      compose(runtimeDirectory, ["--profile", "app", "up", "-d", "--wait", ...maintenanceServices]);
    } catch (error) {
      restartError = error;
    }
  }
  if (backupError && restartError) {
    throw new AggregateError(
      [backupError, restartError],
      "Backup failed and maintenance services could not be restored",
    );
  }
  if (backupError) throw backupError;
  if (restartError) throw restartError;
}

function printHelp() {
  console.log(`Usage: node scripts/deployment/hybrid-production.mjs <command> [options]

Commands:
  check       Validate committed deployment contracts without Docker or network access
  bootstrap   Fetch the pinned upstream Supabase Docker source into .hybrid-production
  preflight   Validate runtime files, production URLs, paths, keys, and secrets
  config      Render and validate the merged Docker Compose configuration
  up          Start Supabase, apply migrations, then start FastAPI and cloudflared
  down        Stop the complete hybrid production stack
  status      Show service status
  logs        Show the latest 200 application-profile log lines
  backup      Create checksummed PostgreSQL and Storage backups

Options:
  --runtime <path>  Override the generated runtime directory
  --force           Replace an incomplete or differently pinned runtime during bootstrap
`);
}

export function runHybridProduction(argv = process.argv.slice(2)) {
  const { command, runtimeDirectory, force } = parseArguments(argv);
  if (command === "check") staticCheck();
  else if (command === "bootstrap") bootstrap(runtimeDirectory, force);
  else if (command === "preflight") preflight(runtimeDirectory);
  else if (command === "config") validateCompose(runtimeDirectory);
  else if (command === "up") startProduction(runtimeDirectory);
  else if (command === "down") stopProduction(runtimeDirectory);
  else if (command === "status") showStatus(runtimeDirectory);
  else if (command === "logs") showLogs(runtimeDirectory);
  else if (command === "backup") createBackup(runtimeDirectory);
  else if (command === "help" || command === "--help" || command === "-h") printHelp();
  else throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runHybridProduction();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
