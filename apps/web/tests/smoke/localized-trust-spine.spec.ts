import { expect, test } from "@playwright/test";

test("uses the same reviewed identity release in English", async ({ page }) => {
  await page.goto("/en/pandas?q=Mei%20Xiang");

  await expect(page.getByRole("heading", { level: 1, name: "All pandas" })).toBeVisible();
  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 panda found");
  await expect(
    page.locator('a[href="/en/pandas/mei-xiang"]').filter({ hasText: "Mei Xiang" }).first(),
  ).toBeVisible();
  await expect(page.getByText("He Hua")).toHaveCount(0);
});

test("never renders the generated legacy profile as a rollback", async ({ request }) => {
  const untrustedLegacy = await request.get("/atlas/he-hua");
  expect(new URL(untrustedLegacy.url()).pathname).toBe("/zh/pandas/he-hua");
  expect(untrustedLegacy.status()).toBe(404);

  if (process.platform === "win32" && process.env.PLAYWRIGHT_BASE_URL) {
    const malformedLegacy = await fetch(new URL("/atlas/%E0%A4%A", process.env.PLAYWRIGHT_BASE_URL), {
      redirect: "manual",
    });
    expect(malformedLegacy.status).not.toBe(500);
  } else {
    const malformedLegacy = await request.get("/atlas/%E0%A4%A", { maxRedirects: 0 });
    expect(malformedLegacy.status()).not.toBe(500);
  }

  const reviewedLegacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(reviewedLegacy.status()).toBe(308);
  expect(reviewedLegacy.headers().location).toContain("/zh/pandas/meixiang");

  const localizedLegacy = await request.get("/en/pandas/meixiang?from=old-link", { maxRedirects: 0 });
  expect(localizedLegacy.status()).toBe(308);
  expect(localizedLegacy.headers().location).toContain("/en/pandas/mei-xiang?from=old-link");
});
