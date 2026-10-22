import { expect, test } from "@playwright/test";

test("finds pandas, families, and places from one URL-addressable query", async ({ page }) => {
  await page.goto("/en/search?q=mei");

  const results = page.getByRole("listbox");
  await expect(results.getByRole("option", { name: /Mei Xiang/ }).first()).toHaveAttribute("href", "/en/pandas/mei-xiang");
  await expect(results.getByRole("option", { name: /From Mei Xiang to Bao Li/ })).toHaveAttribute("href", /\/en\/families\//);
  await expect(page.getByRole("banner").getByRole("link", { name: "中文", exact: true })).toHaveAttribute("href", "/zh/search?q=mei");

  await page.getByTestId("search-page").getByRole("link", { name: /^Families/ }).click();
  await expect(page).toHaveURL(/\/en\/search\?q=mei&type=family$/);
  await expect(results.getByRole("option")).toHaveCount(1);
});

test("updates the URL as the reader types and opens a result from the keyboard", async ({ page }) => {
  await page.goto("/zh/search", { waitUntil: "networkidle" });
  const input = page.getByRole("combobox");

  await input.fill("亚特兰大");
  await expect(page).toHaveURL(/\/zh\/search\?q=%E4%BA%9A%E7%89%B9%E5%85%B0%E5%A4%A7$/);
  await expect(page.getByRole("option", { name: /亚特兰大动物园/ })).toBeVisible();

  await input.press("Enter");
  await expect(page).toHaveURL(/\/zh\/places\/zoo-atlanta$/);
});

test("offers an honest discovery path when nothing matches", async ({ page }) => {
  await page.goto("/en/search?q=nonexistent-panda");

  await expect(page.getByText("Nothing in the published records matches “nonexistent-panda”.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Panda guide" })).toHaveAttribute("href", "/en/pandas");
});

test("renders results without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/search?q=atlanta");

  await expect(page.getByRole("option", { name: /Zoo Atlanta/ })).toHaveAttribute("href", "/en/places/zoo-atlanta");
  await context.close();
});
