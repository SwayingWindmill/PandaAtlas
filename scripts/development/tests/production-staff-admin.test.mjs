import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { approveProductionAdminRequest, assertManagedDatabaseUrl } from "../production-staff-admin.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const accountId = randomUUID();
const request = {
  version: 1,
  operation: "bootstrap",
  accountId,
  approvalId: "IAM05-approved-2026-10-08",
  approvedBy: "deployment-owner",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const signature = sign(null, Buffer.from(JSON.stringify(request)), privateKey).toString("base64");
const approval = { request, signature };
const approvalKey = publicKey.export({ type: "spki", format: "pem" });

test("valid signed production owner approval binds the operation and immutable subject", () => {
  const approved = approveProductionAdminRequest(approval, approvalKey, "bootstrap", accountId);
  assert.equal(approved.approvalId, request.approvalId);
  assert.equal(approved.accountId, accountId);
  assert.throws(() => approveProductionAdminRequest(approval, approvalKey, "recover", accountId), /approval/i);
  assert.throws(() => approveProductionAdminRequest(approval, approvalKey, "bootstrap", randomUUID()), /approval/i);
});

test("tampering, missing signature, untrusted approval or expired approval cannot authorize", () => {
  assert.throws(() => approveProductionAdminRequest({ request: { ...request, approvedBy: "other" }, signature }, approvalKey, "bootstrap", accountId), /signature/i);
  assert.throws(() => approveProductionAdminRequest({ request }, approvalKey, "bootstrap", accountId), /signature/i);
  const outsiderKey = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
  assert.throws(() => approveProductionAdminRequest(approval, outsiderKey, "bootstrap", accountId), /signature/i);
  const expired = { ...request, expiresAt: "2000-01-01T00:00:00.000Z" };
  const expiredSignature = sign(null, Buffer.from(JSON.stringify(expired)), privateKey).toString("base64");
  assert.throws(() => approveProductionAdminRequest({ request: expired, signature: expiredSignature }, approvalKey, "bootstrap", accountId), /expired/i);
});

test("operator credentials must target the approved managed Supabase project", () => {
  const ref = "gsnpkwlezpdkdupizjdb";
  assertManagedDatabaseUrl(`postgresql://postgres:secret@db.${ref}.supabase.co:5432/postgres`, ref);
  assertManagedDatabaseUrl(`postgresql://postgres.${ref}:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`, ref);
  assert.throws(() => assertManagedDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres", ref), /managed/i);
  assert.throws(() => assertManagedDatabaseUrl("postgresql://postgres:secret@db.wrongproject.supabase.co:5432/postgres", ref), /managed/i);
  assert.throws(() => assertManagedDatabaseUrl("postgresql://postgres.otherproject:secret@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres", ref), /managed/i);
});

test("production operator CLI never accesses a database without an approved intent", () => {
  const script = fileURLToPath(new URL("../production-staff-admin.mjs", import.meta.url));
  const badInvocation = spawnSync(process.execPath, [script, "--operation", "bootstrap", "--account-id", accountId, "--apply"], { encoding: "utf8" });
  assert.notEqual(badInvocation.status, 0);
  assert.match(badInvocation.stderr, /environment|approval/i);
  const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /dry-run|--apply/i);
});

test("deployment owner can sign an approval offline without sharing their private key", () => {
  const signer = fileURLToPath(new URL("../sign-production-admin-approval.mjs", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "panda-iam05-"));
  try {
    const privateKeyPath = join(directory, "owner-private.pem");
    const approvalPath = join(directory, "owner-approved.json");
    writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }));
    const args = ["--operation", "bootstrap", "--account-id", accountId,
      "--approval-id", "IAM05-approved-2026-10-08", "--approved-by", "deployment-owner",
      "--private-key", privateKeyPath, "--output", approvalPath];
    const signed = spawnSync(process.execPath, [signer, ...args], { encoding: "utf8" });
    assert.equal(signed.status, 0, signed.stderr);
    const output = JSON.parse(readFileSync(approvalPath, "utf8"));
    const approved = approveProductionAdminRequest(output, approvalKey, "bootstrap", accountId);
    assert.equal(approved.approvedBy, "deployment-owner");
    assert.notEqual(spawnSync(process.execPath, [signer, ...args]).status, 0, "A second signature must not overwrite the approved file");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
