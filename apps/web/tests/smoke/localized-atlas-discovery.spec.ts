import { expect, test } from "@playwright/test";

const SMITHSONIAN_FACILITY_ID = "afb0f227-dd5e-5076-88e3-74e9807a6049";

test("restores URL-driven Atlas pagination through browser history", async ({ page }) => {
  await page.goto("/zh/atlas");

  await expect(page.getByTestId("atlas-result-list").getByRole("listitem")).toHaveCount(4);
  const next = page.getByTestId("atlas-pagination").getByRole("link", { name: "下一页" });
  await expect(next).toHaveAttribute("href", "/zh/atlas?page=2");

  await next.click();
  await expect(page).toHaveURL(/\/zh\/atlas\?page=2$/);
  await expect(page.getByTestId("atlas-result-list").getByRole("listitem")).toHaveCount(4);

  await page.goBack();
  await expect(page).toHaveURL(/\/zh\/atlas$/);
  await expect(page.getByTestId("atlas-result-list").getByRole("listitem")).toHaveCount(4);
});

test("combines reviewed search, sex, facility and sort state", async ({ page }) => {
  await page.goto(`/en/atlas?q=bao&sex=male&facility=${SMITHSONIAN_FACILITY_ID}&sort=name`);

  const results = page.getByTestId("atlas-result-list");
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results.getByRole("link", { name: /Bao Li/ })).toHaveAttribute("href", "/en/atlas/bao-li");
  await expect(page.getByTestId("atlas-result-summary")).toContainText("2 active filters");
});

test("normalizes unsupported and invalid URL state instead of silently retaining it", async ({ page }) => {
  await page.goto("/en/atlas?status=invalid&page=0&unsupported=value");

  await expect(page).toHaveURL(/\/en\/atlas$/);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("10 published profiles");
});

test("preserves compatible discovery state across the locale switch", async ({ page }) => {
  await page.goto("/zh/atlas?q=bao&sex=male&sort=name");

  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute(
    "href",
    "/en/atlas?q=bao&sex=male&sort=name",
  );
});

test("submits native filters from the keyboard and canonicalizes default values", async ({ page }) => {
  await page.goto("/zh/atlas");
  const status = page.getByLabel("生命状态");

  await status.focus();
  await expect(status).toBeFocused();
  await status.selectOption("alive");
  await page.getByRole("button", { name: "应用搜索与筛选" }).last().press("Enter");

  await expect(page).toHaveURL(/\/zh\/atlas\?status=alive$/);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 个筛选条件生效");
});

test("renders searchable results without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/atlas?q=mei+xiang");

  await expect(page.getByTestId("localized-atlas-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mei Xiang/ })).toHaveAttribute("href", "/en/atlas/mei-xiang");
  await context.close();
});
