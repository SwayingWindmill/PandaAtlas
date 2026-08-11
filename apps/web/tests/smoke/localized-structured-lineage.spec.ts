import { expect, test } from "@playwright/test";

const MEI_XIANG_ID = "2939c16f-1938-5629-928c-b36b1d5cd6ed";


test("renders a complete graph-free lineage view inside Families", async ({ page }) => {
  await page.goto("/zh/families?view=lineage&focus=mei-xiang");

  await expect(page).toHaveURL(/\/zh\/families\?view=lineage&focus=mei-xiang$/);
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "熊猫家族" })).toBeVisible();
  await expect(page.getByRole("link", { name: "谱系图" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(MEI_XIANG_ID, { exact: true })).toBeVisible();
  await expect(page.getByTestId("lineage-section-children").locator("article")).toHaveCount(4);
  await expect(page.getByTestId("lineage-section-descendants").locator("article")).toHaveCount(1);
  await expect(page.getByText("先从清晰的关系列表认识这个家族")).toBeVisible();
});


test("shows Bao Li tentative father from reviewed assertions instead of inferred parent fields", async ({ page }) => {
  await page.goto("/en/families?view=lineage&focus=bao-li&descendants=1");

  const tentativeFather = page.getByTestId("lineage-relation-parent-bao-li-father");
  await expect(tentativeFather).toContainText("An An");
  await expect(tentativeFather).toContainText("Tentative");
  await expect(tentativeFather).toContainText("parent-bao-li-father");
  await expect(tentativeFather.getByRole("link").first()).toBeVisible();
  await expect(tentativeFather).toContainText("currently has a family relationship record but no complete profile page");
});


test("selects a relationship in the Families URL and preserves it across locale switching", async ({ page }) => {
  await page.goto("/zh/families?view=lineage&focus=bao-li&descendants=1");
  const relation = page.getByTestId("lineage-relation-parent-bao-li-father");

  await relation.getByRole("link", { name: "了解这段关系" }).click();
  await expect(page).toHaveURL(/relation=parent-bao-li-father/);
  await expect(page.getByTestId("selected-lineage-relation")).toContainText("暂定");
  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute(
    "href",
    "/en/families?view=lineage&focus=bao-li&descendants=1&relation=parent-bao-li-father",
  );
});


test("normalizes invalid lineage state inside Families", async ({ page }) => {
  await page.goto("/en/families?view=lineage&focus=missing&ancestors=9&descendants=0&relation=bad&unsupported=value");

  await expect(page).toHaveURL(/\/en\/families\?view=lineage&focus=shin-shin$/);
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
});


test("standalone lineage routes are removed instead of redirected", async ({ request }) => {
  expect((await request.get("/lineage?focus=bao-li&descendants=1")).status()).toBe(404);
  expect((await request.get("/zh/lineage?focus=bao-li&descendants=1")).status()).toBe(404);
  expect((await request.get("/en/lineage?focus=bao-li&descendants=1")).status()).toBe(404);
});


test("submits lineage scope with native keyboard controls inside Families", async ({ page }) => {
  await page.goto("/en/families?view=lineage&focus=mei-xiang");
  const form = page.getByRole("form", { name: "Update family view" });

  await form.getByLabel("Focus panda").selectOption("bao-li");
  await form.getByLabel("Descendant depth").selectOption("1");
  await form.getByRole("button", { name: "Update family view" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/en\/families\?view=lineage&focus=bao-li&descendants=1$/);
  await expect(page.getByTestId("lineage-relation-parent-bao-li-father")).toContainText("Tentative");
});


test("renders the structured relationship journey without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/families?view=lineage&focus=bao-li&descendants=1");

  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByTestId("lineage-relation-parent-bao-li-father")).toContainText("Tentative");
  await expect(page.getByRole("link", { name: /View panda profile/ }).first()).toBeVisible();
  await context.close();
});
