import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const reviewerAccountId = "11111111-1111-4111-8111-111111111111";
const reviewCaseId = "22222222-2222-4222-8222-222222222222";
const submissionId = "33333333-3333-4333-8333-333333333333";
const pandaId = "44444444-4444-4444-8444-444444444444";
const sourceId = "55555555-5555-4555-8555-555555555555";

const reviewCapabilities = [
  "review.case.read",
  "review.case.intake",
  "review.case.claim",
  "review.case.verify_source",
  "review.case.decide",
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

  await expect(page.getByText("Institutional profile").first()).toBeVisible();

  await expect(page.getByRole("heading", { level: 1, name: "贡献审核队列" })).toBeVisible();
  const resizeHandle = page.getByRole("separator", { name: "调整队列与详情宽度" });
  await expect(resizeHandle).toBeVisible();
  const queuePane = page.getByRole("region", { name: "待办队列" });
  const originalQueueWidth = (await queuePane.boundingBox())?.width ?? 0;
  await resizeHandle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await queuePane.boundingBox())?.width ?? 0).toBeGreaterThan(originalQueueWidth);
  await expect(page.getByRole("button", { name: /熊猫编号 44444444/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /熊猫编号 44444444/ })).toHaveAttribute("aria-current", "true");
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
  await expect(page.getByLabel("来源核验原因")).not.toBeVisible();
  await expect(page.getByLabel("审核决定类型")).not.toBeVisible();
  await expect(page.getByRole("tab", { name: "查看证据", selected: true })).toBeVisible();
  await page.getByRole("tab", { name: "查看证据" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "核验来源", selected: true })).toBeVisible();
  await expect(page.getByLabel("来源核验原因")).toBeVisible();
  await expect(page.getByRole("tab", { name: "核验来源", selected: true })).toBeVisible();
  await expect(page.getByText("核验通过时，请填写正式来源 ID 和规范化地址。")).toBeVisible();
  await page.getByLabel("来源核验原因").fill("核对原始来源");
  await page.getByRole("tab", { name: "审核决定" }).click();
  await expect(page.getByLabel("来源核验原因")).not.toBeVisible();
  await expect(page.getByLabel("审核决定类型")).toBeVisible();
  const assertionSelection = page.getByRole("checkbox", { name: "性别" });
  await assertionSelection.focus();
  await page.keyboard.press("Space");
  await expect(assertionSelection).toBeChecked();
  await expect(page.getByRole("button", { name: "保存审核决定" })).toBeDisabled();
  const actionAccessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(actionAccessibility.violations).toEqual([]);
  await page.getByRole("tab", { name: "核验来源" }).click();
  await expect(page.getByLabel("来源核验原因")).toHaveValue("核对原始来源");
  await page.getByRole("tab", { name: "查看证据" }).click();
  await expect(page.getByRole("heading", { name: "证据来源" })).toBeVisible();
  await expect(page.getByText("JSON payload")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\bcase=/);
  expect(requestedOperations).toEqual([]);

  await page.getByRole("button", { name: "领取案件" }).click();
  await expect(page.getByRole("status")).toContainText("案件已领取。");
  await expect.poll(() => queueReads).toBeGreaterThan(1);
  await expect.poll(() => surfaceReads).toBeGreaterThan(1);
});

test("switching review cases returns to evidence and clears the previous case draft", async ({ page }) => {
  const nextCaseId = "99999999-9999-4999-8999-999999999999";
  const nextPandaId = "88888888-8888-4888-8888-888888888888";
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal2", capabilities: reviewCapabilities }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [reviewQueueItem, { ...reviewQueueItem, reviewCaseId: nextCaseId, targetPandaId: nextPandaId }], total: 2, limit: 25, offset: 0 }),
  }));
  await page.route("**/api/admin/review/cases/*/surface", (route) => {
    const next = route.request().url().includes(nextCaseId);
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(next
        ? { reviewCase: { ...reviewSurface.reviewCase, reviewCaseId: nextCaseId, primaryAssigneeId: reviewerAccountId }, contribution: {
          ...reviewSurface.contribution, targetPandaId: nextPandaId, sources: [{ ...reviewSurface.contribution.sources[0], title: "New case institution" }],
        } }
        : reviewSurface),
    });
  });
  await page.goto("/admin/reviews");
  await expect(page.getByText("Institutional profile").first()).toBeVisible();
  await page.getByRole("tab", { name: "核验来源" }).click();
  await page.getByLabel("来源核验原因").fill("Draft for original case");
  await page.getByLabel("来源核验结果").selectOption("rejected");
  await page.getByRole("tab", { name: "审核决定" }).click();
  await page.getByLabel("审核决定类型").selectOption("duplicate");
  await page.getByRole("button", { name: /熊猫编号 88888888/ }).click();
  await expect(page.getByRole("button", { name: /熊猫编号 88888888/ })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: /熊猫编号 44444444/ })).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("tab", { name: "查看证据", selected: true })).toBeVisible();
  await expect(page.getByText("New case institution").first()).toBeVisible();
  await page.getByRole("tab", { name: "核验来源" }).click();
  await expect(page.getByLabel("来源核验原因")).toHaveValue("");
  await expect(page.getByLabel("来源核验结果")).toHaveValue("verified");
  await page.getByRole("tab", { name: "审核决定" }).click();
  await expect(page.getByLabel("审核决定类型")).toHaveValue("accepted");
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
  await page.getByRole("tab", { name: "审核决定" }).click();
  await expect(page.getByLabel("审核决定类型")).toBeVisible();
  await page.getByLabel("给贡献者的说明").fill("已核实档案资料，接受修改。");
  // Accepting writes the selected facts, so it needs at least one.
  await expect(page.getByRole("button", { name: "保存审核决定" })).toBeDisabled();
  await page.getByRole("checkbox", { name: "性别" }).check();
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

test("review queue offers an explicit retry after the server recovers", async ({ page }) => {
  let unavailable = true;
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ accountId: reviewerAccountId, aal: "aal2", capabilities: ["admin.shell.access", "review.case.read"] }),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill(unavailable
    ? { status: 503, contentType: "application/problem+json", body: JSON.stringify({ detail: "审核队列暂时不可用" }) }
    : { status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, limit: 25, offset: 0 }) }));
  await page.goto("/admin/reviews");
  const retry = page.getByRole("button", { name: "重试加载队列" });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "暂时无法读取审核队列" })).toBeVisible();
  unavailable = false;
  await retry.click();
  await expect(page.getByText("当前筛选条件下没有待审核案件。")).toBeVisible();
  await expect(retry).toHaveCount(0);
});
