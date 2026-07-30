import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("contributor pages are private, localized, feature-flagged, and server authenticated", async () => {
  const [createRoute, listRoute, detailRoute, config, navigation, middleware, login] = await Promise.all([
    source("apps/web/app/[locale]/contribute/page.tsx"),
    source("apps/web/app/[locale]/me/submissions/page.tsx"),
    source("apps/web/app/[locale]/me/submissions/[submissionId]/page.tsx"),
    source("apps/web/features/contribute/config.ts"),
    source("apps/web/components/patterns/global-navigation.tsx"),
    source("apps/web/middleware.ts"),
    source("apps/web/features/auth/email-otp-login.tsx"),
  ]);

  for (const route of [createRoute, listRoute, detailRoute]) {
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /export const revalidate = 0/);
    assert.match(route, /await connection\(\)/);
    assert.match(route, /robots: \{ index: false, follow: false, nocache: true \}/);
    assert.match(route, /getVerifiedSupabaseAccessToken\(\)/);
    assert.match(route, /redirect\(/);
    assert.doesNotMatch(route, /["']use client["']/);
  }
  assert.match(config, /NEXT_PUBLIC_COMMUNITY_INTAKE_ENABLED/);
  assert.match(navigation, /contributeEnabled \? \(/);
  assert.match(navigation, /\/contribute/);
  assert.match(middleware, /redirect\(`\/\$\{preferredLocale\}\/contribute`\)/);
  assert.match(middleware, /redirect\(`\/\$\{preferredLocale\}\/me\/submissions`\)/);
  assert.match(middleware, /unlocalizedSubmission/);
  assert.match(middleware, /me\\\/submissions\\\//);
  assert.doesNotMatch(middleware, /redirect\(`\/\//);
  assert.match(middleware, /isPrivateContributionPath/);
  assert.match(middleware, /no-store, no-cache, private/);
  assert.match(middleware, /noindex, nofollow, noarchive, nosnippet/);
  assert.match(login, /contribute/);
  assert.match(login, /submissions/);
  assert.match(login, /\[0-9a-f\]\{8\}/);
});

test("contributor commands use a server-only proxy, ETags, private multipart upload, and explicit formal submission", async () => {
  const [proxy, commandRoute, attachmentRoute, clientApi, editor] = await Promise.all([
    source("apps/web/lib/server/fastapi-community-intake-proxy.ts"),
    source(
      "apps/web/app/api/community-intake/submissions/[submissionId]/commands/[command]/route.ts",
    ),
    source("apps/web/app/api/community-intake/attachments/[attachmentId]/content/route.ts"),
    source("apps/web/features/contribute/api.ts"),
    source("apps/web/features/contribute/contribution-editor.tsx"),
  ]);

  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /process\.env\.API_BASE_URL/);
  assert.doesNotMatch(proxy, /NEXT_PUBLIC_API_BASE_URL/);
  assert.match(proxy, /getVerifiedSupabaseAccessToken\(\)/);
  assert.match(proxy, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(proxy, /cache: "no-store"/);
  assert.match(proxy, /"X-Robots-Tag": "noindex, nofollow"/);
  assert.match(commandRoute, /If-Match header is required/);
  assert.match(commandRoute, /"If-Match": ifMatch/);
  assert.match(attachmentRoute, /await request\.formData\(\)/);
  assert.match(attachmentRoute, /\/api\/v1\/me\/attachments/);
  assert.match(clientApi, /headers: \{ "If-Match": etag \}/);
  assert.match(clientApi, /formData\.set\("upload_reference"/);
  assert.match(editor, /^["']use client["']/);
  assert.match(editor, /window\.setTimeout\(\(\) => void saveDraft\(\), 900\)/);
  assert.match(editor, /assertions,\s+sources,\s+additional_context/);
  assert.match(editor, /submission\.draft_content\.sources/);
  assert.match(editor, /prepareAttachment\(/);
  assert.match(editor, /uploadAttachment\(/);
  assert.match(editor, /respond-information-request/);
  assert.match(editor, /confirmation: true/);
  assert.match(editor, /explanation\.length < 10/);
});

test("the contributor projection is append-only, upgrade-safe, and drives persistent Inbox updates", async () => {
  const [migration, repository, models, notificationPolicy, notificationRepository] = await Promise.all([
    source("infra/supabase/migrations/0017_contributor_submission_journey.sql"),
    source("services/api/app/community_intake/journey_repository.py"),
    source("services/api/app/community_intake/journey_models.py"),
    source("services/api/app/notification/models.py"),
    source("services/api/app/notification/repository.py"),
  ]);

  assert.match(migration, /create type community_intake\.contributor_status as enum/);
  assert.match(migration, /'action_required'/);
  assert.match(migration, /'incorporated_partial'/);
  assert.match(migration, /'expired'/);
  assert.match(migration, /migration-0017-initial-status/);
  assert.match(migration, /trg_contributor_status_events_append_only/);
  assert.match(migration, /trg_contributor_assertion_results_append_only/);
  assert.match(migration, /trg_contributor_journey_events_append_only/);
  assert.match(migration, /revoke all on all tables in schema community_intake from public/);
  assert.match(repository, /community\.submission\.contributor_status_changed/);
  assert.match(repository, /"account_id": str\(row\["account_id"\]\)/);
  assert.match(repository, /"notification_link": f"\/me\/submissions\/\{submission_id\}"/);
  assert.match(models, /class DraftStructuredAssertionInput/);
  assert.match(models, /class StructuredAssertionInput/);
  assert.match(notificationPolicy, /_CONTRIBUTOR_STATUS_TYPE/);
  assert.match(notificationPolicy, /NotificationCategory\.INCORPORATION/);
  assert.match(notificationRepository, /"notification_link"/);
  assert.match(notificationRepository, /"active_revision_number"/);
});
