import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("moderation facts are versioned, append-only, explicitly authorized, and use canonical outbox", async () => {
  const [migration, service, models] = await Promise.all([
    source("infra/supabase/migrations/0026_moderation_sanctions_and_appeals.sql"),
    source("services/api/app/review_moderation/moderation_service.py"),
    source("services/api/app/review_moderation/moderation_models.py"),
  ]);

  assert.match(migration, /create table review_moderation\.moderation_subjects/);
  assert.match(migration, /create table review_moderation\.moderation_actions/);
  assert.match(migration, /trg_moderation_actions_append_only/);
  assert.match(migration, /trg_appeal_events_append_only/);
  assert.match(migration, /review_moderation\.add_business_days\(now\(\), 5\)/);
  assert.match(migration, /\('reviewer', 'moderation\.sanction\.issue'\)/);
  assert.match(migration, /\('moderator', 'moderation\.appeal\.decide'\)/);
  assert.doesNotMatch(migration, /\('administrator', 'moderation\./);
  assert.match(service, /insert into integration\.outbox_events/);
  assert.doesNotMatch(service, /moderation_outbox_events/);
  assert.match(service, /Reviewer may issue only a submission freeze/);
  assert.match(service, /Reviewer freeze may not exceed 24 hours/);
  assert.match(models, /class MyModerationRead/);
  assert.match(models, /class MyAppealCaseRead/);
});

test("admin moderation workbench stays server-authenticated and outside generic CRUD", async () => {
  const [shell, workbench, proxy, route] = await Promise.all([
    source("apps/web/components/admin/react-admin-shell.tsx"),
    source("apps/web/components/admin/moderation-workbench.tsx"),
    source("apps/web/lib/server/fastapi-moderation-proxy.ts"),
    source("apps/web/app/api/admin/moderation/[[...path]]/route.ts"),
  ]);

  assert.match(shell, /ModerationWorkbench/);
  assert.match(shell, /session\.capabilities\.includes\("moderation\.case\.read"\)/);
  assert.match(shell, /<Route path="moderation" element=\{<ModerationWorkbench \/>\}/);
  assert.match(shell, /The bounded admin shell does not expose generic CRUD business writes/);
  assert.match(workbench, /^"use client"/);
  assert.match(workbench, /\/api\/admin\/moderation/);
  assert.doesNotMatch(workbench, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /cache: "no-store"/);
  assert.match(route, /export const GET = proxy/);
  assert.match(route, /export const POST = proxy/);
});

test("user appeal surface is private, bilingual, and cannot receive internal moderation fields", async () => {
  const [page, surface, route, apiRouter, middleware] = await Promise.all([
    source("apps/web/app/[locale]/me/appeals/page.tsx"),
    source("apps/web/features/moderation/my-appeals.tsx"),
    source("apps/web/app/api/moderation/[[...path]]/route.ts"),
    source("services/api/app/api/v1/admin_moderation.py"),
    source("apps/web/middleware.ts"),
  ]);

  assert.match(page, /privatePage: true/);
  assert.match(page, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(surface, /`\/api\/moderation\$\{path\}`/);
  assert.match(surface, /moderationFetch<MyModeration>\("\/actions"\)/);
  assert.match(surface, /moderationFetch<AppealQueue>\("\/appeals"\)/);
  assert.match(surface, /My restrictions and appeals/);
  assert.doesNotMatch(surface, /internal_resolution/);
  assert.doesNotMatch(surface, /internal_explanation/);
  assert.match(apiRouter, /response_model=MyAppealCaseRead/);
  assert.match(apiRouter, /response_model=MyModerationRead/);
  assert.doesNotMatch(apiRouter, /internal_resolution=appeal\.internal_resolution/);
  assert.match(apiRouter, /def _user_safe_appeal/);
  assert.match(route, /proxyUserModerationRequest/);
  assert.match(middleware, /submissions\|appeals/);
  assert.match(middleware, /noindex, nofollow, noarchive, nosnippet/);
});
