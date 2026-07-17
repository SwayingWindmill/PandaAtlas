import { expect, test } from "@playwright/test";

const MEI_XIANG_ID = "2939c16f-1938-5629-928c-b36b1d5cd6ed";


test("renders a complete graph-free descendant journey for Mei Xiang", async ({ page }) => {
  await page.goto("/zh/lineage");

  await expect(page).toHaveURL(/\/zh\/lineage\?focus=mei-xiang$/);
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "结构化熊猫谱系" })).toBeVisible();
  await expect(page.getByText(MEI_XIANG_ID, { exact: true })).toBeVisible();
  await expect(page.getByTestId("lineage-section-children").locator("article")).toHaveCount(4);
  await expect(page.getByTestId("lineage-section-descendants").locator("article")).toHaveCount(1);
  await expect(page.getByText("图形不是完成任务的前提")).toBeVisible();
});


test("shows Bao Li tentative father from reviewed assertions instead of inferred parent fields", async ({ page }) => {
  await page.goto("/en/lineage?focus=bao-li&descendants=1");

  const tentativeFather = page.getByTestId("lineage-relation-parent-bao-li-father");
  await expect(tentativeFather).toContainText("An An");
  await expect(tentativeFather).toContainText("Tentative");
  await expect(tentativeFather).toContainText("parent-bao-li-father");
  await expect(tentativeFather.getByRole("link").first()).toBeVisible();
  await expect(tentativeFather).toContainText("does not yet have an accessible full profile");
});


test("selects a relationship in the URL and preserves it across locale switching", async ({ page }) => {
  await page.goto("/zh/lineage?focus=bao-li&descendants=1");
  const relation = page.getByTestId("lineage-relation-parent-bao-li-father");

  await relation.getByRole("link", { name: "查看此关系" }).click();
  await expect(page).toHaveURL(/relation=parent-bao-li-father/);
  await expect(page.getByTestId("selected-lineage-relation")).toContainText("暂定");
  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute(
    "href",
    "/en/lineage?focus=bao-li&descendants=1&relation=parent-bao-li-father",
  );
});


test("normalizes invalid focus, depth, relation and unsupported parameters", async ({ page }) => {
  await page.goto("/en/lineage?focus=missing&ancestors=9&descendants=0&relation=bad&unsupported=value");

  await expect(page).toHaveURL(/\/en\/lineage\?focus=mei-xiang$/);
  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
});


test("legacy lineage route redirects by request language and preserves task state", async ({ request }) => {
  const response = await request.get("/lineage?focus=bao-li&descendants=1", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(308);
  expect(response.headers().location).toContain("/en/lineage?focus=bao-li&descendants=1");
});


test("submits lineage scope with native keyboard controls", async ({ page }) => {
  await page.goto("/en/lineage?focus=mei-xiang");
  const form = page.getByRole("form", { name: "Update lineage scope" });

  await form.getByLabel("Focus panda").selectOption("bao-li");
  await form.getByLabel("Descendant depth").selectOption("1");
  await form.getByRole("button", { name: "Update lineage scope" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/en\/lineage\?focus=bao-li&descendants=1$/);
  await expect(page.getByTestId("lineage-relation-parent-bao-li-father")).toContainText("Tentative");
});


test("renders the structured relationship journey without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/lineage?focus=bao-li&descendants=1");

  await expect(page.getByTestId("structured-lineage-page")).toBeVisible();
  await expect(page.getByTestId("lineage-relation-parent-bao-li-father")).toContainText("Tentative");
  await expect(page.getByRole("link", { name: /Open trusted profile/ }).first()).toBeVisible();
  await context.close();
});
