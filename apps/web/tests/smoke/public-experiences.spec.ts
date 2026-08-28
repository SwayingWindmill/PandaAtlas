import { expect, test } from "@playwright/test";

test("Panda Moments preserves URL state and distinguishes source events from anniversaries", async ({ page }) => {
  await page.goto("/zh/moments?year=2026&anniversaries=1&panda=xi-lun");

  await expect(page.getByRole("heading", { level: 1, name: "熊猫时光" })).toBeVisible();
  await expect(page.getByText("公开版本: 2026.08.12.1 · Schema v2")).toBeVisible();
  await expect(page.locator("main")).toContainText("生日周年");
  await expect(page.locator("main")).toContainText("喜伦");
  await expect(page.locator("input[name=year]")).toHaveValue("2026");
  await expect(page.locator("select[name=panda]")).toHaveValue("xi-lun");
  await expect(page.locator("select[name=anniversaries]")).toHaveValue("1");
  const locationSelect = page.locator("select[name=location]");
  await expect(locationSelect).toBeVisible();
  const firstLocation = await locationSelect.locator("option:not([value=''])").first().getAttribute("value");
  expect(firstLocation).toBeTruthy();
  await locationSelect.selectOption(firstLocation!);
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page).toHaveURL(new RegExp(`location=${encodeURIComponent(firstLocation!)}`));

  const sourceIds = await page.locator("text=/来源事件 ID:/").allTextContents();
  expect(new Set(sourceIds).size).toBe(sourceIds.length);
});

test("English Panda Moments renders a truthful empty state", async ({ page }) => {
  await page.goto("/en/moments?year=1800&panda=mei-xiang");

  await expect(page.getByRole("heading", { level: 1, name: "Panda Moments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No public moments match these filters" })).toBeVisible();
  await expect(page.getByText(/This does not prove inactivity/)).toBeVisible();
});

test("Family Stories preserve declared scope and relationship status", async ({ page }) => {
  await page.goto("/zh/families/smithsonian-generations");

  await expect(page.getByRole("heading", { level: 1, name: "从美香到宝力" })).toBeVisible();
  await expect(page.getByText(/明确声明的部分范围/)).toBeVisible();
  await expect(page.getByText("parent-bao-li-father", { exact: true })).toBeVisible();
  await expect(page.getByText("tentative", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "美香" }).first()).toHaveAttribute("href", "/zh/pandas/mei-xiang");

  await page.goto("/en/families/ueno-twins");
  await expect(page.getByRole("heading", { level: 1, name: "The Ueno twin family" })).toBeVisible();
  await expect(page.getByText(/complete for its declared scope/)).toBeVisible();
  await expect(page.getByText("confirmed", { exact: true }).first()).toBeVisible();
});

test("Profile V2 links into Moments, Lineage, and a related Family Story", async ({ page }) => {
  await page.goto("/en/pandas/xi-lun");

  await expect(page.getByText("Rich profile", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Panda Moments" })).toHaveAttribute(
    "href",
    "/en/moments?panda=xi-lun",
  );
  await expect(page.getByRole("link", { name: "View family lineage" })).toHaveAttribute(
    "href",
    "/en/families?view=lineage&focus=xi-lun",
  );

  await page.goto("/en/pandas/ri-ri");
  await expect(page.getByRole("link", { name: "The Ueno twin family" })).toHaveAttribute(
    "href",
    "/en/families/ueno-twins",
  );
});

test("public experience pages remain readable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  for (const path of [
    "/zh/moments?year=2026&anniversaries=1",
    "/zh/families/smithsonian-generations",
    "/en/families/ueno-twins",
  ]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
});

test("public experience core content works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  await page.goto("/zh/moments?year=2026&anniversaries=1&panda=xi-lun");
  await expect(page.getByRole("heading", { level: 1, name: "熊猫时光" })).toBeVisible();
  await expect(page.locator("main")).toContainText("喜伦");
  await expect(page.locator("form")).toHaveAttribute("method", "get");

  await page.goto("/en/families/ueno-twins");
  await expect(page.getByRole("heading", { level: 1, name: "The Ueno twin family" })).toBeVisible();
  await expect(page.locator("main")).toContainText("parent-xiao-xiao-mother");

  await context.close();
});
