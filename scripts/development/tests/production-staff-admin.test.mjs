import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../production-staff-admin.mjs", import.meta.url));

test("the owner CLI refuses before connecting when the operation, subject or database is missing", () => {
  const env = { ...process.env, PANDAATLAS_IAM_OPERATOR_DATABASE_URL: "", PANDAATLAS_IAM_DATABASE_SSL_CA_CERT: "" };
  const noOperation = spawnSync(process.execPath, [script, "--account-id", randomUUID(), "--apply"], { encoding: "utf8", env });
  assert.notEqual(noOperation.status, 0);
  assert.match(noOperation.stderr, /--operation/);
  const noDatabase = spawnSync(process.execPath, [script, "--operation", "bootstrap", "--account-id", randomUUID()], { encoding: "utf8", env });
  assert.notEqual(noDatabase.status, 0);
  assert.match(noDatabase.stderr, /PANDAATLAS_IAM_OPERATOR_DATABASE_URL/);
  const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /dry-run/);
});
