import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("ReviewCase remains independent, versioned, append-only, and explicitly authorized", async () => {
  const [migration, service, models, contract] = await Promise.all([
    source("infra/supabase/migrations/0019_review_moderation_review_cases.sql"),
    source("services/api/app/review_moderation/service.py"),
    source("services/api/app/review_moderation/models.py"),
    source("services/api/openapi/review-moderation-v1.yaml"),
  ]);

  assert.match(migration, /create schema if not exists review_moderation/);
  assert.match(migration, /create unique index idx_review_cases_one_active_submission/);
  assert.match(migration, /review case version must increase by exactly one/);
  assert.match(migration, /reviewer cannot be assigned to their own submission/);
  assert.match(migration, /reviewer cannot decide their own submission/);
  assert.match(migration, /trg_review_decisions_append_only/);
  assert.match(migration, /review_moderation\.sla_alerts/);
  assert.match(migration, /\('reviewer'\), \('moderator'\)/);
  assert.doesNotMatch(migration, /\('admin', 'review\.case/);
  assert.match(service, /_replayed_case_id/);
  assert.match(service, /_check_not_self/);
  assert.match(service, /review_evidence_not_ready/);
  assert.match(service, /community_intake\.contributor_status_events/);
  assert.match(models, /class ReviewDecisionOutcome/);
  assert.match(models, /ACCEPTED = "accepted"/);
  assert.match(models, /ABUSE = "abuse"/);
  assert.match(contract, /BearerAuth/);
  assert.match(contract, /operationId: decideReviewCase/);
});

test("reviewer workbench is bounded, server authenticated, and never enables generic CRUD", async () => {
  const [shell, workbench, proxy, route, evidenceRoute] = await Promise.all([
    source("apps/web/components/admin/react-admin-shell.tsx"),
    source("apps/web/components/admin/review-case-workbench.tsx"),
    source("apps/web/lib/server/fastapi-admin-review-proxy.ts"),
    source("apps/web/app/api/admin/review-cases/[[...path]]/route.ts"),
    source("apps/web/app/api/admin/review-evidence/[attachmentId]/route.ts"),
  ]);

  assert.match(shell, /ReviewCaseWorkbench/);
  assert.match(shell, /session\.capabilities\.includes\("review\.case\.read"\)/);
  assert.match(shell, /The bounded admin shell does not expose generic CRUD business writes/);
  assert.match(shell, /<Route path="reviews" element=\{<ReviewCaseWorkbench \/>\}/);
  assert.match(workbench, /^"use client"/);
  assert.match(workbench, /\/api\/admin\/review-cases/);
  assert.doesNotMatch(workbench, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(workbench, /internal_note: internalNote \|\| null/);
  assert.match(workbench, /clean_accessible \? "clean，可申请访问"/);
  assert.match(workbench, /记录不可变决定/);
  assert.match(workbench, /推荐所选断言进入 Curation/);
  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /cache: "no-store"/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
  assert.match(evidenceRoute, /community-intake\/attachments/);
  assert.match(evidenceRoute, /getVerifiedSupabaseAccessToken\(\)/);
});

test("accepted decisions require active revision, verified sources, clean attachments, and selected assertions", async () => {
  const [service, migration, workbench] = await Promise.all([
    source("services/api/app/review_moderation/service.py"),
    source("infra/supabase/migrations/0019_review_moderation_review_cases.sql"),
    source("apps/web/components/admin/review-case-workbench.tsx"),
  ]);

  assert.match(service, /active_revision_number/);
  assert.match(service, /latest_outcome is distinct from 'verified'/);
  assert.match(service, /attachment\.state <> 'clean'/);
  assert.match(service, /selected\.issubset\(assertion_keys\)/);
  assert.match(migration, /outcome <> 'accepted' or jsonb_array_length\(selected_assertion_keys\) > 0/);
  assert.match(workbench, /decisionOutcome === "accepted" && selectedAssertions\.length === 0/);
  assert.match(workbench, /只有 clean 附件可进入短时、审计访问流程/);
});
