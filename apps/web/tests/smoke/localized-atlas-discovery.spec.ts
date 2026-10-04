import { expect, test } from "@playwright/test";

test("normalizes unsupported and invalid URL state instead of silently retaining it", async ({ page }) => {
  await page.goto("/en/pandas?status=invalid&page=0&unsupported=value");

  await expect(page).toHaveURL(/\/en\/pandas$/);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("3 pandas are currently included");
});

test("preserves compatible discovery state across the locale switch", async ({ page }) => {
  await page.goto("/zh/pandas?q=mei&sex=female&sort=name");

  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute(
    "href",
    "/en/pandas?q=mei&sex=female&sort=name",
  );
});

test("submits native filters from the keyboard and canonicalizes default values", async ({ page }) => {
  await page.goto("/zh/pandas");
  const status = page.getByLabel("生命状态");

  await status.focus();
  await expect(status).toBeFocused();
  await status.selectOption("alive");
  await page.getByRole("button", { name: "应用搜索与筛选" }).last().press("Enter");

  await expect(page).toHaveURL(/\/zh\/pandas\?status=alive$/);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 个筛选条件生效");
});

test("renders searchable results without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/pandas?q=mei+xiang");

  await expect(page.getByTestId("localized-pandas-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mei Xiang/ })).toHaveAttribute("href", "/en/pandas/mei-xiang");
  await context.close();
});
