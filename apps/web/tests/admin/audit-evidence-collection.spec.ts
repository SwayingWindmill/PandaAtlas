import { expect, test } from "@playwright/test";

const evidence = [
  {
    sourceEventId: "00000000-0000-4000-8000-000000000101",
    sourceContext: "publication",
    eventType: "publication.release.activated",
    aggregateType: "publication_release",
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

  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Audit", exact: true })).toHaveAttribute("href", "/admin/audit");
  await expect(page.getByRole("heading", { level: 1, name: "Audit evidence" })).toBeVisible();
  await expect(page.getByText("publication.release.activated", { exact: true })).toBeVisible();
  expect(requestedLimits).toContain("25");

  await page.getByLabel("Rows").selectOption("50");
  await expect(page).toHaveURL(/\/admin\/audit\/evidence\?limit=50$/);
  await expect.poll(() => requestedLimits.at(-1)).toBe("50");
});
