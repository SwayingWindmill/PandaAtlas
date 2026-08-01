import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateProductionOrigins } from "../hybrid-production.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../../..");
const deploymentDirectory = path.join(repositoryRoot, "deploy", "hybrid-production");
const scriptPath = path.join(repositoryRoot, "scripts", "deployment", "hybrid-production.mjs");

function read(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("hybrid production static contract passes", () => {
  const output = execFileSync(process.execPath, [scriptPath, "check"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const result = JSON.parse(output);

  assert.equal(result.status, "passed");
  assert.equal(result.host_ports_published, 0);
  assert.deepEqual(result.backup_surfaces, ["postgres", "storage"]);
});

test("production overlay removes host ingress and requires tunnel ingress", () => {
  const compose = read("deploy/hybrid-production/docker-compose.zhipanda.yml");

  assert.equal((compose.match(/ports: !override \[\]/g) ?? []).length, 2);
  assert.match(compose, /cloudflare\/cloudflared:2026\.7\.2/);
  assert.match(compose, /CLOUDFLARE_TUNNEL_TOKEN:\?Set CLOUDFLARE_TUNNEL_TOKEN/);
  assert.doesNotMatch(compose, /\n  api:[\s\S]*?\n    ports:/m);
  assert.match(compose, /DB_USE_MOCK_FALLBACK: "false"/);
});

test("production environment example contains placeholders only", () => {
  const environmentExample = read("deploy/hybrid-production/zhipanda.env.example");

  assert.match(environmentExample, /CLOUDFLARE_TUNNEL_TOKEN=\[REDACTED_SECRET\]/);
  assert.match(environmentExample, /ADMIN_API_TOKEN=\[REDACTED_SECRET\]/);
  assert.doesNotMatch(environmentExample, /eyJ[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(environmentExample, /sk_live_/);
});

test("production CORS origins are explicit HTTPS origins", () => {
  assert.deepEqual(validateProductionOrigins("https://zhipanda.example.org"), []);
  assert.deepEqual(
    validateProductionOrigins("https://zhipanda.example.org,https://admin.zhipanda.example.org"),
    [],
  );
  for (const invalid of [
    "*",
    "http://zhipanda.example.org",
    "https://localhost",
    "https://www.example.com",
    "https://zhipanda.example.org/",
    "https://zhipanda.example.org/path",
    "not-a-url",
  ]) {
    assert.notDeepEqual(validateProductionOrigins(invalid), [], invalid);
  }
});

test("upstream Supabase source is pinned to a full commit", () => {
  const reference = readFileSync(path.join(deploymentDirectory, "supabase.ref"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  assert.match(reference, /^[0-9a-f]{40}$/);
});

test("API image packages migrations and excludes local build state", () => {
  const dockerfile = read("services/api/Dockerfile");
  const dockerignore = read(".dockerignore");

  assert.match(dockerfile, /apply_production_migrations\.py/);
  assert.match(dockerfile, /infra\/supabase\/migrations/);
  assert.match(dockerfile, /^USER zhipanda$/m);
  assert.match(dockerignore, /\*\*\/\.venv/);
  assert.match(dockerignore, /\.hybrid-production/);
});

test("deployments back up before migration and use a maintenance backup window", () => {
  const manager = read("scripts/deployment/hybrid-production.mjs");
  const compose = read("deploy/hybrid-production/docker-compose.zhipanda.yml");
  const preMigrationBackup = manager.indexOf('["--profile", "ops", "run", "--rm", "db-backup"]');
  const migration = manager.indexOf('["--profile", "ops", "run", "--rm", "migrate"]');

  assert.ok(preMigrationBackup >= 0 && preMigrationBackup < migration);
  assert.match(manager, /maintenanceServices = \["cloudflared", "api", "storage", "imgproxy"\]/);
  assert.match(manager, /"stop", \.\.\.maintenanceServices/);
  assert.match(compose, /\.partial/);
  assert.match(compose, /read_only: true/);
  assert.equal((compose.match(/command:\n      - -ec\n      - \|/g) ?? []).length, 2);
  assert.doesNotMatch(compose, /entrypoint:\n      - \/bin\/(?:bash|sh)\n      - -ec/);
});
