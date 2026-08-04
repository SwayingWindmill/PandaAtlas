import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("Audit workbench is bounded, server authenticated, and capability separated", async () => {
  const [shell, workbench, proxy, route] = await Promise.all([
    source("apps/web/components/admin/react-admin-shell.tsx"),
    source("apps/web/components/admin/audit-workbench.tsx"),
    source("apps/web/lib/server/fastapi-admin-audit-proxy.ts"),
    source("apps/web/app/api/admin/audit/[[...path]]/route.ts"),
  ]);

  assert.match(shell, /AuditWorkbench/);
  assert.match(shell, /session\.capabilities\.includes\("audit\.read"\)/);
  assert.match(shell, /<Route path="audit" element=\{<AuditWorkbench \/>\}/);
  assert.match(shell, /The bounded admin shell does not expose generic CRUD business writes/);

  assert.match(workbench, /^"use client"/);
  assert.match(workbench, /\/api\/admin\/audit\//);
  assert.match(workbench, /capabilities\.includes\("audit\.export"\)/);
  assert.match(workbench, /capabilities\.includes\("audit\.integrity\.manage"\)/);
  assert.match(workbench, /capabilities\.includes\("audit\.maintain"\)/);
  assert.match(workbench, /生成加密导出/);
  assert.match(workbench, /清理过期密文/);
  assert.match(workbench, /通用 CRUD 始终禁用/);
  assert.doesNotMatch(workbench, /NEXT_PUBLIC_API_BASE_URL/);

  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /UUID_PATTERN/);
  assert.match(proxy, /Unsupported Audit operation/);
  assert.match(proxy, /maintenance\/retention/);
  assert.doesNotMatch(proxy, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
});
