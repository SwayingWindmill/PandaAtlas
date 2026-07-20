import { expect, test } from "@playwright/test";

test("renders the complete Chinese Editorial Home information architecture", async ({ page }) => {
  await page.goto("/zh");

  await expect(page.getByTestId("editorial-home")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "从一只熊猫开始，查证身份、亲缘与迁移" })).toBeVisible();
  await expect(page.getByTestId("editorial-selections")).toContainText("编辑精选");
  await expect(page.getByTestId("relationship-place-exploration")).toContainText("关系与地点");
  await expect(page.getByTestId("recent-archive-revisions")).toContainText("最近档案修订");
  await expect(page.getByTestId("archive-method")).toContainText("档案方法");
  await expect(page.getByText("这是编辑选择，不是热度、访问量或受欢迎程度排名。")).toBeVisible();
});

test("renders real editorial selections with canonical profile links", async ({ page }) => {
  await page.goto("/en");
  const selections = page.getByTestId("editorial-selections");

  for (const [name, href] of [
    ["Mei Xiang", "/en/atlas/mei-xiang"],
    ["Bao Li", "/en/atlas/bao-li"],
    ["Xiao Qi Ji", "/en/atlas/xiao-qi-ji"],
  ]) {
    await expect(selections.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(selections.locator("article")).toHaveCount(3);
  await expect(selections).toContainText("not rankings by popularity, traffic, or engagement");
});

test("links relationship and place exploration to existing canonical surfaces", async ({ page }) => {
  await page.goto("/en");
  const exploration = page.getByTestId("relationship-place-exploration");

  await expect(exploration.getByRole("link", { name: "Open structured lineage" })).toHaveAttribute(
    "href",
    "/en/lineage?focus=mei-xiang",
  );
  await expect(exploration.getByRole("link", { name: "Open structured map" })).toHaveAttribute(
    "href",
    "/en/map?mode=institutions&snapshot=2026.07.20.1",
  );
  await expect(exploration.getByRole("link", { name: "Smithsonian institution" })).toHaveAttribute(
    "href",
    "/en/institutions/smithsonian-national-zoo",
  );
  await expect(exploration.getByRole("link", { name: "Wolong Shenshuping place" })).toHaveAttribute(
    "href",
    "/en/places/wolong-shenshuping-base",
  );
});

test("publishes only real localized revision summaries from the current release", async ({ page }) => {
  await page.goto("/en");
  const revisions = page.getByTestId("recent-archive-revisions");

  await expect(revisions.getByRole("listitem")).toHaveCount(4);
  await expect(revisions).toContainText("Public release: 2026.07.20.1");
  await expect(revisions).toContainText("Public review of identity, parentage, birth date, and current facility.");
  await expect(revisions).not.toContainText("Tian Tian");
});

test("keeps canonical and alternate language metadata on the Editorial Home", async ({ page }) => {
  await page.goto("/en");

  await expect(page).toHaveTitle(/trusted bilingual living archive/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
  await expect(page.locator('link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute("href", /\/zh$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/zh$/);
  await expect(page.getByRole("link", { name: "中文", exact: true })).toHaveAttribute("href", "/zh");
});

test("searches the localized Atlas without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en");

  const query = page.getByLabel("Panda name, alias, or public identifier");
  await query.fill("mei xiang");
  await query.press("Enter");

  await expect(page).toHaveURL(/\/en\/atlas\?q=mei(\+|%20)xiang$/);
  await expect(page.getByTestId("localized-atlas-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mei Xiang/ })).toHaveAttribute("href", "/en/atlas/mei-xiang");
  await context.close();
});

test("remains no-media-safe and reflows at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/zh");

  await expect(page.getByTestId("editorial-home")).toBeVisible();
  await expect(page.getByTestId("editorial-home").locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
