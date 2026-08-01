import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const CHANGE_SET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ARCHIVE_RELEASE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PUBLIC_RELEASE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const session = {
  account_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  email: "archive-operator@example.test",
  state: "active",
  roles: ["senior_archive_editor"],
  capabilities: [
    "account.session.read",
    "admin.shell.access",
    "archive.workbench.read",
    "archive.accountable.validate",
    "archive.accountable.publish",
    "archive.accountable.rollback",
    "archive.accountable.correct",
    "archive.cutover.manage",
    "archive.sensitive.merge_split",
    "archive.sensitive.takedown",
  ],
  recent_auth: true,
  authenticated_at: "2026-07-31T14:30:00Z",
  authentication_method: "otp",
  assurance_level: "aal1",
  expires_at: "2026-07-31T15:30:00Z",
};

const metrics = {
  ordinary_ready: 1,
  sensitive_ready: 0,
  publish_failed: 0,
  projection_lag: 1,
  emergency_followup: 0,
  cutover_state: "open",
  cutover_version: 7,
};

const snapshot = {
  generated_at: "2026-07-31T14:35:00Z",
  old_state_counts: { approved: 0, submitted: 0 },
  accountable_state_counts: { ready: 1, published: 2 },
  release_counts: { archive: 2, public: 1 },
  orphan_counts: { revisions: 0, releases: 0 },
  historical_audit_count: 12,
  archive_pointer_release_id: ARCHIVE_RELEASE_ID,
  public_pointer_release_id: PUBLIC_RELEASE_ID,
  canonical_sha256: "a".repeat(64),
  go: true,
  blockers: [],
};

const workbenchItem = {
  item_type: "change_set",
  item_id: CHANGE_SET_ID,
  queue: "ordinary_ready",
  title: "Mei Xiang profile evidence update",
  status: "ready",
  risk_level: "ordinary",
  version: 2,
  base_archive_version: "archive-2026.07.31",
  release_id: null,
  operation_id: null,
  created_at: "2026-07-31T14:00:00Z",
  updated_at: "2026-07-31T14:20:00Z",
};

const workbenchDetail = {
  item: workbenchItem,
  current_archive_version: "archive-2026.07.31",
  current_public_version: "public-2026.07.30",
  change_set_id: CHANGE_SET_ID,
  governance_mode: "single-accountable-approver-v1",
  validation_state: "ready",
  validation_hash: "b".repeat(64),
  validation_issues: [],
  structured_diff: [{ field: "intro", before: "Old", after: "Reviewed" }],
  source_evidence: [{ source_id: "source:verified-profile" }],
  attachment_evidence: [{ asset_id: "asset-1", rights: "reviewed" }],
  release_notes: "Verified profile correction",
  public_impact: { public_urls: ["/zh/pandas/mei-xiang"] },
  operation_effect: {},
  operation_subject: null,
  actor_roles: ["archive_editor"],
  actor_capabilities: ["archive.accountable.validate"],
  emergency_followup_due_at: null,
  emergency_followup_change_set_id: null,
};

async function fulfillJson(route: Route, body: object, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
    headers: { "Cache-Control": "no-store, private" },
  });
}

async function mockSession(page: Page, overrides: Partial<typeof session> = {}) {
  await page.route("**/api/admin/session", (route) =>
    fulfillJson(route, { ...session, ...overrides }),
  );
}

async function mockWorkbenchReads(page: Page) {
  await page.route("**/api/admin/archive/workbench/metrics", (route) =>
    fulfillJson(route, metrics),
  );
  await page.route("**/api/admin/archive/workbench/rehearsal-snapshot", (route) =>
    fulfillJson(route, snapshot),
  );
  await page.route(/\/api\/admin\/archive\/workbench\?.*$/, (route) =>
    fulfillJson(route, { items: [workbenchItem], total: 1 }),
  );
  await page.route(`**/api/admin/archive/workbench/items/${CHANGE_SET_ID}`, (route) =>
    fulfillJson(route, workbenchDetail),
  );
}

async function expectNoWcagViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("Archive workbench deep link is private, keyboard-safe, and runs explicit commands", async ({
  page,
}) => {
  await mockSession(page);
  await mockWorkbenchReads(page);

  let validationPayload: Record<string, unknown> | null = null;
  let cutoverPayload: Record<string, unknown> | null = null;
  await page.route(`**/api/admin/archive/change-sets/${CHANGE_SET_ID}/validate`, async (route) => {
    validationPayload = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      validation_result_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      change_set_id: CHANGE_SET_ID,
      outcome: "ready",
      risk_level: "ordinary",
      base_archive_version: "archive-2026.07.31",
      validation_hash: "b".repeat(64),
      governance_version: 3,
      validated_by: session.account_id,
      validated_at: "2026-07-31T14:40:00Z",
      reason: "Reviewed complete evidence and public impact in the Archive workbench.",
      issues: [],
    });
  });
  await page.route("**/api/admin/archive/workbench/cutover", async (route) => {
    cutoverPayload = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, { state: "held", version: 8 });
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
  await expect(page.getByText("Mei Xiang profile evidence update")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "结构化 Diff" })).toBeVisible();
  await expect(page.getByText("a".repeat(64))).toBeVisible();

  const readyQueue = page.getByRole("button", { name: /普通待发布/ });
  await readyQueue.focus();
  await expect(readyQueue).toBeFocused();

  await page.getByRole("button", { name: "显式验证" }).click();
  await expect.poll(() => validationPayload).not.toBeNull();
  expect(validationPayload).toMatchObject({
    expected_version: 2,
    base_archive_version: "archive-2026.07.31",
    risk_level: "ordinary",
  });

  await page.getByRole("button", { name: "Hold 新发布" }).click();
  await expect.poll(() => cutoverPayload).not.toBeNull();
  expect(cutoverPayload).toMatchObject({ expected_version: 7, state: "held" });

  await expectNoWcagViolations(page);
});

test("Senior Archive operations are mobile-safe and preserve sensitive command shape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSession(page);
  await page.route("**/api/admin/archive/workbench/rehearsal-snapshot", (route) =>
    fulfillJson(route, snapshot),
  );

  let mergePayload: Record<string, unknown> | null = null;
  await page.route("**/api/admin/archive/operations/merge-split", async (route) => {
    mergePayload = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      operation_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      release_id: "99999999-9999-4999-8999-999999999999",
      operation_type: "merge",
      public_projection_status: "pending",
      followup_due_at: null,
    });
  });

  const response = await page.goto("/admin/archive/operations", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(
    page.getByRole("heading", { level: 1, name: "合并、拆分与紧急下架" }),
  ).toBeVisible({ timeout: 60_000 });

  await page.getByLabel("新 data_version").first().fill("archive-map-close-merge");
  await page.getByLabel("源实体，每行 type:id").fill("panda:source-a\npanda:source-b");
  await page.getByLabel("目标实体，每行 type:id").fill("panda:destination");

  const mergeButton = page.getByRole("button", { name: "创建新的 Merge Release" });
  await mergeButton.focus();
  await expect(mergeButton).toBeFocused();
  await expect(mergeButton).toBeEnabled();
  await mergeButton.click();
  await expect.poll(() => mergePayload).not.toBeNull();
  expect(mergePayload).toMatchObject({
    expected_archive_release_id: ARCHIVE_RELEASE_ID,
    operation_type: "merge",
    risk_level: "sensitive",
    source_entities: [
      { entity_type: "panda", entity_id: "source-a" },
      { entity_type: "panda", entity_id: "source-b" },
    ],
    destination_entities: [{ entity_type: "panda", entity_id: "destination" }],
  });

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expectNoWcagViolations(page);
});

test("stale authentication disables sensitive Archive operations", async ({ page }) => {
  await mockSession(page, { recent_auth: false });
  await page.route("**/api/admin/archive/workbench/rehearsal-snapshot", (route) =>
    fulfillJson(route, snapshot),
  );

  await page.goto("/admin/archive/operations", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("敏感操作要求 15 分钟内认证。请重新登录后再提交。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建新的 Merge Release" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "创建紧急下架 Release" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "登记正式跟进" })).toBeDisabled();
});
