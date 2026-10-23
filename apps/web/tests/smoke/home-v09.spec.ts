import { expect, test } from "@playwright/test";

test("the home introduces pandas through photo cards and section entrances", async ({ page }) => {
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "最近更新的熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "把喜欢的熊猫留在身边" })).toBeVisible();
  // Each photo card carries the panda's licensed cover and opens its profile.
  const card = page.locator('a[href="/zh/pandas/mei-xiang"]').filter({ has: page.locator("img") }).first();
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveAttribute("src", /\/media\/pandas\/photos\/mei-xiang\.png$/);
  await expect(page.getByRole("link", { name: "全部熊猫" }).first()).toHaveAttribute("href", "/zh/pandas");

  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: "Meet every panda" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Recently updated pandas" })).toBeVisible();
});

test("the home search opens the panda list with the query", async ({ page }) => {
  await page.goto("/zh");

  await page.getByRole("searchbox", { name: "搜索熊猫" }).fill("美香");
  await page.getByRole("searchbox", { name: "搜索熊猫" }).press("Enter");

  await expect(page).toHaveURL(/\/zh\/pandas\?q=%E7%BE%8E%E9%A6%99$/);
  await expect(page.getByTestId("atlas-result-summary")).toContainText("共找到 1 只");
});

test("the home core content works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: "认识每一只熊猫" })).toBeVisible();
  await expect(page.locator('a[href="/zh/pandas/mei-xiang"]').first()).toBeAttached();
  await context.close();
});
