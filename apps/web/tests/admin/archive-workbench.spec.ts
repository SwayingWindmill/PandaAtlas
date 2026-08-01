import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const changeSetId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const archiveReleaseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const publicReleaseId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const canonicalSha = "a".repeat(64);

const session = {
  account_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  email: "senior-archive@example.test",
  state: "active",
  roles: ["senior_archive_editor"],
  capabilities: [
    "account.session.read",
    "admin.shell.access",
    "archive.workbench.read",
    "archive.cutover.manage",
    "archive.accountable.validate",
    "archive.accountable.publish",
    "archive.accountable.rollback",
    "archive.accountable.correct",
    "archive.sensitive.publish",
    "archive.sensitive.rollback",
    "archive.sensitive.correct",
  ],
  recent_auth: true,
  authenticated_at: "2026-07-31T12:00:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-07-31T13:00:00Z",
};

const item = {
  item_type: "change_set",
  item_id: itemId,
  queue: "ordinary_ready",
  title: "Verified profile correction",
  status: "ready",
  risk_level: "ordinary",
  version: 2,
  base_archive_version: "accountable-base-1",
  release_id: null,
  operation_id: null,
  created_at: "2026-07-31T11:00:00Z",
  updated_at: "2026-07-31T11:30:00Z",
};

const detail = {
  item,
  current_archive_version: "accountable-base-1",
  current_public_version: "accountable-public-1",
  change_set_id: changeSetId,
  governance_mode: "single-accountable-approver-v1",
  validation_state: "ready",
  validation_hash: "b".repeat(64),
  validation_issues: [],
  structured_diff: [
    {
      entity_type: "panda",
      entity_id: "panda-1",
      payload_sha256: "c".repeat(64),
    },
  ],
  source_evidence: [{ source_id: "source-1", status: "verified" }],
  attachment_evidence: [{ attachment_id: "attachment-1", scan_status: "clean" }],
  release_notes: "Reviewed evidence and public impact.",
  public_impact: { public_urls: ["/zh/pandas/panda-1"] },
  operation_effect: {},
  operation_subject: { entity_type: "panda", entity_id: "panda-1" },
  actor_roles: ["archive_editor"],
  actor_capabilities: ["archive.accountable.validate"],
  emergency_followup_due_at: null,
  emergency_followup_change_set_id: null,
};

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" },
  });
}

test("Archive workbench is private, mobile-safe, keyboard-usable, and WCAG clean", async ({
  page,
}) => {
  page.on("pageerror", (error) => console.log(`[pageerror] ${error.stack ?? error.message}`));
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));

  let cutoverState: "open" | "held" = "open";
  let cutoverVersion = 1;
  let cutoverPayload: Record<string, unknown> | null = null;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/admin/session", async (route) => fulfillJson(route, session));
  await page.route("**/api/admin/archive/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/admin/archive/workbench/metrics") {
      await fulfillJson(route, {
        ordinary_ready: 1,
        sensitive_ready: 1,
        publish_failed: 0,
        projection_lag: 1,
        emergency_followup: 0,
        cutover_state: cutoverState,
        cutover_version: cutoverVersion,
      });
      return;
    }
    if (url.pathname === "/api/admin/archive/workbench/rehearsal-snapshot") {
      await fulfillJson(route, {
        generated_at: "2026-07-31T12:00:00Z",
        old_state_counts: { approved: 2 },
        accountable_state_counts: { ready: 1 },
        release_counts: { publish: 1 },
        orphan_counts: { release_evidence: 0, operations: 0, activity_events: 0 },
        historical_audit_count: 8,
        archive_pointer_release_id: archiveReleaseId,
        public_pointer_release_id: publicReleaseId,
        canonical_sha256: canonicalSha,
        go: true,
        blockers: [],
      });
      return;
    }
    if (url.pathname === `/api/admin/archive/workbench/items/${itemId}`) {
      await fulfillJson(route, detail);
      return;
    }
    if (url.pathname === "/api/admin/archive/workbench/cutover") {
      cutoverPayload = request.postDataJSON() as Record<string, unknown>;
      cutoverState = String(cutoverPayload.state) as "open" | "held";
      cutoverVersion += 1;
      await fulfillJson(route, {
        state: cutoverState,
        version: cutoverVersion,
        changed_at: "2026-07-31T12:01:00Z",
      });
      return;
    }
    if (url.pathname === "/api/admin/archive/workbench") {
      await fulfillJson(route, { items: [item], total: 1 });
      return;
    }

    await route.fulfill({ status: 404, body: "not found" });
  });

  const response = await page.goto("/admin/archive", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");

  await expect(
    page.getByRole("heading", { level: 1, name: "Archive 发布与迁移工作台" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Verified profile correction")).toBeVisible();
  await expect(page.getByRole("heading", { name: "完整证据与显式命令" })).toBeVisible();
  await expect(page.getByText("GO", { exact: true })).toBeVisible();
  await expect(page.getByText(canonicalSha, { exact: true })).toBeVisible();

  const holdButton = page.getByRole("button", { name: "Hold 新发布" });
  await holdButton.focus();
  await expect(holdButton).toBeFocused();
  await holdButton.click();
  await expect(page.getByText("held", { exact: true })).toBeVisible();
  expect(cutoverPayload).toMatchObject({
    expected_version: 1,
    state: "held",
  });

  const overflowingElements = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        text: element.textContent?.trim().slice(0, 80) ?? "",
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
      }))
      .filter((element) => element.left < -1 || element.right > innerWidth + 1),
  );
  expect(overflowingElements).toEqual([]);
  await expectNoWcagViolations(page);
});
