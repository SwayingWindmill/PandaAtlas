import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const reviewerAccountId = "11111111-1111-4111-8111-111111111111";
const reviewCaseId = "22222222-2222-4222-8222-222222222222";
const submissionId = "33333333-3333-4333-8333-333333333333";
const pandaId = "44444444-4444-4444-8444-444444444444";
const sourceId = "55555555-5555-4555-8555-555555555555";
const moderationAccountId = "66666666-6666-4666-8666-666666666666";
const sanctionId = "77777777-7777-4777-8777-777777777777";
const appealCaseId = "88888888-8888-4888-8888-888888888888";

const reviewCapabilities = [
  "review.case.read",
  "review.case.intake",
  "review.case.claim",
  "review.case.verify_source",
  "review.case.decide",
  "review.case.recommend",
];

const moderationCapabilities = [
  "moderation.sanction.read",
  "moderation.sanction.apply",
  "moderation.sanction.restore",
  "moderation.appeal.decide",
];

const reviewQueueItem = {
  reviewCaseId,
  submissionId,
  revisionNumber: 1,
  state: "new",
  version: 1,
  riskLevel: "normal",
  targetPandaId: pandaId,
  contributorStatus: "submitted",
  createdAt: "2026-10-05T08:00:00.000Z",
  updatedAt: "2026-10-05T08:00:00.000Z",
  firstResponseDueAt: "2026-10-05T20:00:00.000Z",
  slaOverdue: false,
  queueAgeSeconds: 1800,
};

const reviewSurface = {
  reviewCase: {
    reviewCaseId,
    submissionId,
    revisionNumber: 1,
    state: "new",
    version: 1,
  },
  contribution: {
    submissionId,
    targetPandaId: pandaId,
    revisionNumber: 1,
    publicVersionSeen: "2026.10.05.1",
    assertions: [
      {
        assertionKey: "profile.sex",
        fieldKey: "profile.sex",
        value: "female",
        certainty: "confirmed",
        lastVerifiedOn: "2026-10-05",
        sourceIds: [sourceId],
      },
    ],
    sources: [
      {
        sourceId,
        sourceKind: "url",
        title: "Institutional profile",
        locator: "https://example.org/panda",
        publisher: "Example Zoo",
      },
    ],
    attachments: [],
  },
};

test("review queue replaces the generic runner with typed collection and case actions", async ({ page }) => {
  const requestedOperations: string[] = [];
  let queueReads = 0;
  let surfaceReads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/admin/operations")) requestedOperations.push(request.url());
  });
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal2", capabilities: reviewCapabilities }),
    });
  });
  await page.route("**/api/admin/review/cases?**", async (route) => {
    queueReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [reviewQueueItem], total: 1, limit: 25, offset: 0 }),
    });
  });
  await page.route(`**/api/admin/review/cases/${reviewCaseId}/surface`, async (route) => {
    surfaceReads += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reviewSurface) });
  });
  await page.route(`**/api/admin/review/cases/${reviewCaseId}/claim`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...reviewSurface.reviewCase, state: "assigned", primaryAssigneeId: reviewerAccountId }),
    });
  });

  await page.goto("/admin/reviews");

  await expect(page.getByRole("heading", { level: 1, name: "贡献审核队列" })).toBeVisible();
  await expect(page.getByRole("button", { name: /熊猫编号 44444444/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待核验事实" })).toBeVisible();
  await expect(page.getByText("性别", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("雌性", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Institutional profile").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "查看机构原文" })).toHaveAttribute("href", "https://example.org/panda");
  await page.getByRole("link", { name: "查看机构原文" }).focus();
  await expect(page.getByRole("link", { name: "查看机构原文" })).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page.getByRole("button", { name: "领取案件" })).toBeVisible();
  await expect(page.getByLabel("来源核验原因")).toBeVisible();
  await expect(page.getByLabel("审核决定类型")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存审核决定" })).toBeDisabled();
  await expect(page.getByText("核验通过时，需要提供正式来源及其规范化地址。")).toBeVisible();
  await expect(page.getByText("JSON payload")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\bcase=/);
  expect(requestedOperations).toEqual([]);

  await page.getByRole("button", { name: "领取案件" }).click();
  await expect(page.getByRole("status")).toContainText("案件已领取。");
  await expect.poll(() => queueReads).toBeGreaterThan(1);
  await expect.poll(() => surfaceReads).toBeGreaterThan(1);
});

test("assigned review explains ownership instead of offering a misleading claim action", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal2", capabilities: reviewCapabilities }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [{ ...reviewQueueItem, state: "assigned" }], total: 1, limit: 25, offset: 0 }),
  }));
  await page.route(`**/api/admin/review/cases/${reviewCaseId}/surface`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ reviewCase: { ...reviewSurface.reviewCase, state: "assigned", primaryAssigneeId: reviewerAccountId }, contribution: reviewSurface.contribution }),
  }));
  await page.goto("/admin/reviews");
  await expect(page.getByText("此案件由你负责，请继续核验来源并作出审核决定。")).toBeVisible();
  await expect(page.getByRole("button", { name: "领取案件" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "证据来源" })).toBeVisible();
  await expect(page.getByLabel("审核决定类型")).toBeVisible();
  await page.getByLabel("给贡献者的说明").fill("已核实档案资料，接受修改。");
  await expect(page.getByRole("button", { name: "保存审核决定" })).toBeEnabled();
});

test("review queue keeps collection state in the URL", async ({ page }) => {
  const reads: Array<{ state: string | null; offset: string | null }> = [];
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal1", capabilities: reviewCapabilities }),
    });
  });
  await page.route("**/api/admin/review/cases?**", async (route) => {
    const url = new URL(route.request().url());
    reads.push({ state: url.searchParams.get("state"), offset: url.searchParams.get("offset") });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 60, limit: 25, offset: Number(url.searchParams.get("offset") ?? 0) }),
    });
  });

  await page.goto("/admin/reviews");
  await page.getByLabel("队列状态").selectOption("assigned");
  await expect(page).toHaveURL(/\/admin\/reviews\?state=assigned$/);
  await expect.poll(() => reads.at(-1)).toEqual({ state: "assigned", offset: "0" });

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/\/admin\/reviews\?state=assigned&page=2$/);
  await expect.poll(() => reads.at(-1)).toEqual({ state: "assigned", offset: "25" });
});

test("moderation shows the appeal queue, account projection, and typed appeal decision", async ({ page }) => {
  let appealDecisionBody: unknown;
  let appealReads = 0;
  let accountReads = 0;
  const appealItem = {
    appealCaseId,
    accountId: moderationAccountId,
    sanctionId,
    state: "open",
    version: 1,
    userStatement: "Please review the evidence again; I believe this suspension should be reversed.",
    createdAt: "2026-10-05T08:00:00.000Z",
    updatedAt: "2026-10-05T08:00:00.000Z",
    firstResponseDueAt: "2026-10-05T20:00:00.000Z",
    slaOverdue: false,
    ageSeconds: 1800,
  };
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal2", capabilities: moderationCapabilities }),
    });
  });
  await page.route("**/api/admin/moderation/appeals?**", async (route) => {
    appealReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [appealItem], total: 1, limit: 25, offset: 0 }),
    });
  });
  await page.route(`**/api/admin/moderation/accounts/${moderationAccountId}`, async (route) => {
    accountReads += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subject: {
          accountId: moderationAccountId,
          version: 2,
          submissionRestricted: false,
          attachmentRestricted: false,
          notificationRestricted: false,
          accountSuspended: true,
          accountClosedForAbuse: false,
          repeatAbuseCount: 1,
        },
        sanctions: [{
          sanctionId,
          accountId: moderationAccountId,
          kind: "account_suspended",
          reasonCode: "repeat_abuse",
          startsAt: "2026-10-05T07:30:00.000Z",
          createdAt: "2026-10-05T07:30:00.000Z",
        }],
      }),
    });
  });
  await page.route(`**/api/admin/moderation/appeals/${appealCaseId}/decision`, async (route) => {
    appealDecisionBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        decisionId: "99999999-9999-4999-8999-999999999999",
        appealCaseId,
        outcome: "overturned",
        decidedByAccountId: reviewerAccountId,
      }),
    });
  });

  await page.goto("/admin/moderation");

  await expect(page.getByRole("heading", { level: 1, name: "账号治理与申诉" })).toBeVisible();
  await expect(page.getByText("Please review the evidence again; I believe this suspension should be reversed.")).toBeVisible();
  await expect(page.getByText("账号已暂停", { exact: true })).toBeVisible();
  await expect(page.getByText("账号当前处于暂停状态，请在处理申诉前核对限制原因与时间。")).toBeVisible();
  await expect(page.getByRole("button", { name: /账号 66666666/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "执行限制" })).toBeVisible();
  await expect(page).not.toHaveURL(/\b(?:appeal|account)=/);
  await page.getByLabel("申诉处理结果").selectOption("overturned");
  await page.getByLabel("申诉内部说明").fill("The evidence does not support continuing this account suspension.");
  await page.getByLabel("申诉用户说明").fill("Your appeal was accepted and the account suspension has been removed.");
  await page.getByRole("button", { name: "保存申诉决定" }).click();

  await expect.poll(() => appealDecisionBody).toEqual({
    outcome: "overturned",
    internalExplanation: "The evidence does not support continuing this account suspension.",
    userVisibleExplanation: "Your appeal was accepted and the account suspension has been removed.",
  });
  await expect(page.getByRole("status")).toContainText("申诉处理结果已记录。");
  await expect.poll(() => appealReads).toBeGreaterThan(1);
  await expect.poll(() => accountReads).toBeGreaterThan(1);
});

test("moderation actions stay capability scoped", async ({ page }) => {
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal1", capabilities: ["moderation.sanction.read"] }),
    });
  });
  await page.route(`**/api/admin/moderation/accounts/${moderationAccountId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        subject: {
          accountId: moderationAccountId,
          version: 1,
          submissionRestricted: false,
          attachmentRestricted: false,
          notificationRestricted: false,
          accountSuspended: false,
          accountClosedForAbuse: false,
          repeatAbuseCount: 0,
        },
        sanctions: [],
      }),
    });
  });

  await page.goto("/admin/moderation");
  await page.getByLabel("账号 ID").fill(moderationAccountId);
  await page.getByRole("button", { name: "查询账号" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "账号治理与申诉" })).toBeVisible();
  await expect(page.getByText("当前账号没有处理申诉的权限。")).toBeVisible();
  await expect(page.getByRole("button", { name: "执行限制" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存申诉决定" })).toHaveCount(0);
});
