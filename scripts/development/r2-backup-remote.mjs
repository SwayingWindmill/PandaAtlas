#!/usr/bin/env node
// Creates the rclone `r2` remote for the research backup with the Cloudflare CLI, in place of the
// dashboard steps of research-backup-wizard.sh: an account API token limited to object read/write on
// one bucket, turned into S3 credentials (key ID = token ID, secret = SHA-256 of the token value).
// Run it yourself, from the repository root, after `cf` is logged in and the bucket exists:
//   node scripts/development/r2-backup-remote.mjs [--dry-run]
// No key is printed; the secret goes from this process straight into rclone's own config.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKET = "pandaatlas-research-backup";
const dryRun = process.argv.includes("--dry-run");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} ${args[1] ?? ""} failed:\n${result.stderr.trim()}`);
  return result.stdout;
}
const cf = (args, env) => JSON.parse(run("npx", ["--no-install", "cf", ...args], env));

const accounts = cf(["accounts", "list"]);
if (accounts.length !== 1) throw new Error(`Expected one Cloudflare account, found ${accounts.length}.`);
const accountId = accounts[0].id;
const env = { CLOUDFLARE_ACCOUNT_ID: accountId };

const groups = cf(["accounts", "tokens", "permission-groups", "list"], env);
const group = (name) => {
  const found = groups.find((item) => item.name === name);
  if (!found) throw new Error(`Permission group not found: ${name}`);
  return { id: found.id };
};
const policies = [
  {
    effect: "allow",
    permission_groups: [group("Workers R2 Storage Bucket Item Read"), group("Workers R2 Storage Bucket Item Write")],
    resources: { [`com.cloudflare.edge.r2.bucket.${accountId}_default_${BUCKET}`]: "*" },
  },
];
const name = `rclone ${BUCKET} ${new Date().toISOString().slice(0, 10)}`;
// Through a file: on Windows the command runs via cmd.exe, which would strip the JSON's quotes.
const policyFile = join(mkdtempSync(join(tmpdir(), "r2-token-")), "policies.json");
writeFileSync(policyFile, JSON.stringify(policies));
const create = ["accounts", "tokens", "create", "--name", `"${name}"`, "--policies", `@${policyFile}`];

if (dryRun) {
  cf([...create, "--dry-run"], env);
  console.log(`Dry run passed: would create "${name}" with object read/write on ${BUCKET} only.`);
  process.exit(0);
}

const token = cf(create, env);
if (typeof token.id !== "string" || typeof token.value !== "string") {
  throw new Error(`Token "${name}" was created, but the response has no id/value (fields: ${Object.keys(token).join(", ")}). Delete it in the dashboard and report this.`);
}
const secret = createHash("sha256").update(token.value).digest("hex");
run(
  "rclone",
  ["config", "create", "r2", "s3", "provider=Cloudflare", "acl=private", "no_check_bucket=true",
    `endpoint=https://${accountId}.r2.cloudflarestorage.com`, `access_key_id=${token.id}`, `secret_access_key=${secret}`],
);
// A new token answers 401 for a few seconds until it propagates.
for (let attempt = 1; ; attempt++) {
  try {
    run("rclone", ["lsf", `r2:${BUCKET}`, "--max-depth", "1"]);
    break;
  } catch (error) {
    if (attempt === 6) throw error;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}
console.log(`Created token "${name}" and the rclone remote r2; r2:${BUCKET} answers.`);
