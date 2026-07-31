import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("Archive workbench is bounded, server authenticated, and does not expose generic CRUD", async () => {
  const [shell, workbench, proxy, route] = await Promise.all([
    source("apps/web/components/admin/react-admin-shell.tsx"),
    source("apps/web/components/admin/archive-workbench.tsx"),
    source("apps/web/lib/server/fastapi-admin-archive-proxy.ts"),
    source("apps/web/app/api/admin/archive/[[...path]]/route.ts"),
  ]);

  assert.match(shell, /ArchiveWorkbench/);
  assert.match(shell, /session\.capabilities\.includes\("archive\.workbench\.read"\)/);
  assert.match(shell, /<Route path="\/archive" element=\{<ArchiveWorkbench \/>\}/);
  assert.match(shell, /The bounded admin shell does not expose generic CRUD business writes/);
  assert.match(workbench, /^"use client"/);
  assert.match(workbench, /\/api\/admin\/archive/);
  assert.doesNotMatch(workbench, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(workbench, /显式验证/);
  assert.match(workbench, /显式发布/);
  assert.match(workbench, /创建回滚 Release/);
  assert.match(workbench, /创建修正 \/ 撤回 Release/);
  assert.match(workbench, /Hold 新发布/);
  assert.match(workbench, /Resume 新发布/);
  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /X-Robots-Tag/);
  assert.match(proxy, /Cache-Control/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
});

test("cutover is database enforced, versioned, recently authenticated, and reversible", async () => {
  const [migration, service, workbench, runbook] = await Promise.all([
    source("infra/supabase/migrations/0024_archive_workbench_cutover.sql"),
    source("services/api/app/archive_workbench/service.py"),
    source("apps/web/components/admin/archive-workbench.tsx"),
    source("docs/runbooks/archive-governance-cutover.md"),
  ]);

  assert.match(migration, /trg_publication_batches_cutover_hold/);
  assert.match(migration, /before insert on public\.publication_batches/);
  assert.match(migration, /archive\.cutover\.manage/);
  assert.match(migration, /Archive cutover requires recent authentication/);
  assert.match(migration, /archive_cutover_command_receipts/);
  assert.match(migration, /archive_cutover_audit/);
  assert.doesNotMatch(migration, /\('administrator', 'archive\.cutover\.manage'\)/);
  assert.match(service, /cutover_payload_sha256/);
  assert.match(workbench, /canManageCutover/);
  assert.match(workbench, /hasRecentAuth/);
  assert.match(runbook, /Moving either Release pointer backward/);
  assert.match(runbook, /do not delete single-approver Releases/);
});

test("rehearsal produces deterministic GO NO-GO evidence", async () => {
  const [service, script, contract] = await Promise.all([
    source("services/api/app/archive_workbench/service.py"),
    source("services/api/scripts/rehearse_archive_governance_cutover.py"),
    source("services/api/openapi/archive-workbench-v1.yaml"),
  ]);

  assert.match(service, /old_state_counts/);
  assert.match(service, /accountable_state_counts/);
  assert.match(service, /orphan_counts/);
  assert.match(service, /canonical_sha256/);
  assert.match(script, /--require-go/);
  assert.match(script, /temporary\.replace\(args\.output\)/);
  assert.match(contract, /operationId: getArchiveRehearsalSnapshot/);
  assert.match(contract, /canonical_sha256/);
});
