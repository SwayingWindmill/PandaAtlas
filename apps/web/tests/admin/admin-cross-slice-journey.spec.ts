import { expect, test } from "@playwright/test";

test("staff follows a Review audit event from the dashboard into the governed Review queue", async ({ page }) => {
  const reviewCaseId = "22222222-2222-4222-8222-222222222222";
  const submissionId = "33333333-3333-4333-8333-333333333333";
  const pandaId = "44444444-4444-4444-8444-444444444444";
  const sourceId = "55555555-5555-4555-8555-555555555555";
  const eventType = "review.incorporation-recommended";
  const requests: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/admin/")) requests.push(request.url());
  });
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      accountId: "11111111-1111-4111-8111-111111111111",
      aal: "aal2",
      capabilities: ["admin.shell.access", "audit.read", "review.case.read"],
    }),
  }));
  await page.route("**/api/admin/audit/evidence?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify([{
      sourceEventId: "00000000-0000-4000-8000-000000000101",
      sourceContext: "review", eventType,
      aggregateType: "review_case", aggregateId: reviewCaseId,
      correlationId: "00000000-0000-4000-8000-000000000301",
      occurredAt: "2026-10-08T10:00:00.000Z",
      recordedAt: "2026-10-08T10:00:01.000Z", payloadSha256: "a".repeat(64),
    }]),
  }));
  await page.route("**/api/admin/review/cases?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ items: [{
      reviewCaseId, submissionId, revisionNumber: 1, state: "incorporation_recommended", version: 2,
      riskLevel: "normal", targetPandaId: pandaId, contributorStatus: "submitted",
      createdAt: "2026-10-08T09:00:00.000Z", updatedAt: "2026-10-08T09:00:00.000Z",
      firstResponseDueAt: "2026-10-09T09:00:00.000Z", slaOverdue: false, queueAgeSeconds: 1800,
    }], total: 1, limit: 25, offset: 0 }),
  }));
  await page.route(`**/api/admin/review/cases/${reviewCaseId}/surface`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      reviewCase: { reviewCaseId, submissionId, revisionNumber: 1, state: "incorporation_recommended", version: 2 },
      contribution: {
        submissionId, revisionNumber: 1, targetPandaId: pandaId,
        assertions: [{ assertionKey: "profile.sex", fieldKey: "profile.sex", value: "female",
          certainty: "confirmed", lastVerifiedOn: "2026-10-08", sourceIds: [sourceId] }],
        sources: [{ sourceId, sourceKind: "url", title: "Institutional evidence",
          locator: "https://example.org/panda", publisher: "Example Zoo" }],
        attachments: [],
      },
    }),
  }));

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "数据运营工作台" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "后台导航" });
  await expect(navigation.getByRole("link", { name: "策展" })).toHaveCount(0);
  await navigation.getByRole("link", { name: "审计" }).click();
  await expect(page).toHaveURL(/\/admin\/audit\/evidence$/);
  await expect(navigation.getByRole("link", { name: "审计" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("已建议将审核结果纳入档案", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "查看审计详情" }).click();
  await page.getByRole("region", { name: "审计事件详情" })
    .getByRole("link", { name: "前往审核队列" }).click();
  await expect(page).toHaveURL(/\/admin\/reviews$/);
  await expect(navigation.getByRole("link", { name: "审核" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "贡献审核队列" })).toBeVisible();
  await expect(page.getByText("Institutional evidence").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "领取案件" })).toHaveCount(0);
  expect(requests.some((url) => url.includes("/api/admin/operations"))).toBe(false);
  expect(requests.some((url) => url.includes("/api/admin/audit/evidence?"))).toBe(true);
  expect(requests.some((url) => url.includes("/api/admin/review/cases?"))).toBe(true);
});
