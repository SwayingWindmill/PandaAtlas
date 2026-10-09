import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const evidence = [
  {
    sourceEventId: "00000000-0000-4000-8000-000000000101",
    sourceContext: "publication",
    eventType: "publication.release.activated",
    aggregateType: "public_release",
    aggregateId: "00000000-0000-4000-8000-000000000201",
    correlationId: "00000000-0000-4000-8000-000000000301",
    occurredAt: "2026-10-03T10:00:00.000Z",
    payloadSha256: "a".repeat(64),
    recordedAt: "2026-10-03T10:00:01.000Z",
  },
];

const auditSession = {
  accountId: "11111111-1111-4111-8111-111111111111",
  aal: "aal2",
  capabilities: ["audit.read"],
};

test("audit evidence collection renders rows and keeps the supported limit in the URL", async ({ page }) => {
  const requestedLimits: string[] = [];
  await page.route("**/api/admin/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(auditSession),
    });
  });
  await page.route("**/api/admin/audit/evidence?**", async (route) => {
    requestedLimits.push(new URL(route.request().url()).searchParams.get("limit") ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(evidence),
    });
  });

  await page.goto("/admin/audit/evidence?limit=25", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("navigation", { name: "后台导航" })).toBeVisible();
  await expect(page.getByRole("link", { name: "审计", exact: true })).toHaveAttribute("href", "/admin/audit/evidence");
  await expect(page.getByRole("heading", { level: 1, name: "审计证据" })).toBeVisible();
  await expect(page.getByText("publication.release.activated", { exact: true })).toBeVisible();
  expect(requestedLimits).toContain("25");

  await page.getByRole("button", { name: "查看审计详情" }).click();
  const details = page.getByRole("region", { name: "审计事件详情" });
  await expect(details.getByText(evidence[0].sourceEventId, { exact: true })).toBeVisible();
  await expect(details.getByText(evidence[0].correlationId, { exact: true })).toBeVisible();
  await expect(details.getByText(evidence[0].payloadSha256, { exact: true })).toBeVisible();
  await expect(details.getByRole("link", { name: "查看关联发布版本" }))
    .toHaveAttribute("href", `/admin/publication?release=${evidence[0].aggregateId}`);

  await page.getByLabel("最近记录数").selectOption("50");
  await expect(page).toHaveURL(/\/admin\/audit\/evidence\?limit=50$/);
  await expect.poll(() => requestedLimits.at(-1)).toBe("50");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("audit records never expose invented object links and use only supported limit URL state", async ({ page }) => {
  const reviewEvidence = [{ ...evidence[0], sourceContext: "review", aggregateType: "review_case",
    eventType: "review.incorporation-recommended" }];
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(auditSession),
  }));
  await page.route("**/api/admin/audit/evidence?**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(reviewEvidence),
  }));
  await page.goto("/admin/audit/evidence?limit=25");
  await page.getByRole("button", { name: "查看审计详情" }).click();
  const details = page.getByRole("region", { name: "审计事件详情" });
  await expect(details.getByText(reviewEvidence[0].aggregateId, { exact: true })).toBeVisible();
  await expect(details.getByRole("link", { name: "前往审核队列" })).toHaveAttribute("href", "/admin/reviews");
  await expect(details.getByRole("link", { name: "查看关联发布版本" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /JSON|操作/ })).toHaveCount(0);
});
