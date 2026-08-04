import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("Privacy workbench is capability-scoped and uses explicit commands", async () => {
  const [shell, workbench, proxy, route] = await Promise.all([
    source("apps/web/components/admin/react-admin-shell.tsx"),
    source("apps/web/components/admin/privacy-workbench.tsx"),
    source("apps/web/lib/server/fastapi-admin-privacy-proxy.ts"),
    source("apps/web/app/api/admin/privacy/[[...path]]/route.ts"),
  ]);

  assert.match(shell, /PrivacyWorkbench/);
  assert.match(shell, /session\.capabilities\.includes\("privacy\.operate"\)/);
  assert.match(shell, /<Route path="privacy" element=\{<PrivacyWorkbench \/>\}/);
  assert.match(shell, /The bounded admin shell does not expose generic CRUD business writes/);

  assert.match(workbench, /^"use client"/);
  assert.match(workbench, /\/api\/admin\/privacy/);
  assert.doesNotMatch(workbench, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(workbench, /generate-export/);
  assert.match(workbench, /execute-private-deletion/);
  assert.match(workbench, /finalize-account-deletion/);
  assert.match(workbench, /replay_tombstones_after_restore/);
  assert.match(workbench, /restoreConfirmation !== "REAPPLY"/);
  assert.match(workbench, /这里不提供通用 CRUD/);
  assert.match(workbench, /不会显示导出密文、认证材料或原邮箱/);

  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /function isAllowed/);
  assert.match(proxy, /return NextResponse\.json\(\{ detail: "Not found" \}, \{ status: 404 \}\)/);
  assert.match(proxy, /cache: "no-store"/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
});

test("Privacy workbench exposes counts without crypto or contact material", async () => {
  const [workbench, models, maintenance] = await Promise.all([
    source("apps/web/components/admin/privacy-workbench.tsx"),
    source("services/api/app/privacy_operations/models.py"),
    source("services/api/app/privacy_operations/maintenance.py"),
  ]);

  assert.match(models, /class PrivacyMetricsSnapshot/);
  assert.match(models, /oldest_open_request_age_seconds/);
  assert.match(models, /tombstone_replay_count_24h/);
  assert.match(maintenance, /privacy\.metrics\.read/);
  assert.match(maintenance, /privacy_request_age/);
  assert.match(maintenance, /privacy_hold_review_overdue/);
  assert.match(workbench, /MetricCard label="失败 Context"/);
  assert.match(workbench, /MetricCard label="孤儿附件"/);
  assert.match(workbench, /MetricCard label="逾期 Hold"/);
  assert.doesNotMatch(models, /ciphertext:|tombstone_email:|former_email/);
});
