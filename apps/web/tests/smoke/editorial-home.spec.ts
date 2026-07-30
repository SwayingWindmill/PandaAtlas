import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.route("**/media/releases/**/*.webp", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/png", body: ONE_PIXEL_PNG });
  });
});

test("renders the complete Chinese ZhiPanda Home information architecture", async ({ page }) => {
  await page.goto("/zh");

  await expect(page.getByTestId("editorial-home")).toBeVisible();
  await expect(page.getByTestId("public-delivery-notice")).toContainText("正在显示最近可用的熊猫资料");
  await expect(page.getByTestId("public-delivery-notice")).not.toContainText("公共结构");
  await expect(page.getByRole("heading", { level: 1, name: "认识你关注的每一只熊猫" })).toBeVisible();
  await expect(page.getByTestId("home-hero-media-image")).toBeVisible();
  await expect(page.getByTestId("home-hero-media")).toContainText("CC BY-SA 4.0");
  await expect(page.getByTestId("editorial-selections")).toContainText("今天认识哪只熊猫？");
  await expect(page.getByTestId("relationship-place-exploration")).toContainText("从美香到宝宝，再到宝力");
  await expect(page.getByTestId("recent-archive-revisions")).toContainText("最近更新");
  await expect(page.getByTestId("archive-method")).toContainText("资料原则");
  await expect(page.getByText("精选用于帮助开始探索，不代表访问量或受欢迎程度排名。")).toBeVisible();
  await expect(page.getByRole("link", { name: "美香", exact: true })).toHaveAttribute("href", /\/zh\/pandas\?q=/);
});

test("renders real editorial selections with canonical profile links", async ({ page }) => {
  await page.goto("/en");
  const selections = page.getByTestId("editorial-selections");

  for (const [name, href] of [
    ["Bao Li", "/en/pandas/bao-li"],
    ["Qing Bao", "/en/pandas/qing-bao"],
    ["Lun Lun", "/en/pandas/lun-lun"],
    ["Shin Shin", "/en/pandas/shin-shin"],
  ]) {
    await expect(selections.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(selections.locator("article")).toHaveCount(4);
  await expect(selections.locator("img")).toHaveCount(4);
  await expect(selections).toContainText("not popularity or traffic rankings");
});

test("links relationship and place exploration to existing canonical surfaces", async ({ page }) => {
  await page.goto("/en");
  const exploration = page.getByTestId("relationship-place-exploration");

  await expect(exploration.getByRole("link", { name: "See the full family" })).toHaveAttribute(
    "href",
    "/en/lineage?focus=mei-xiang",
  );
  await expect(exploration.getByRole("link", { name: "Open the panda map" })).toHaveAttribute(
    "href",
    /\/en\/map\?mode=institutions&snapshot=2026\.\d{2}\.\d{2}\.\d+$/,
  );
  await expect(exploration.getByRole("link", { name: "Smithsonian National Zoo" })).toHaveAttribute(
    "href",
    "/en/institutions/smithsonian-national-zoo",
  );
  await expect(exploration.getByRole("link", { name: "Wolong Shenshuping Base" })).toHaveAttribute(
    "href",
    "/en/places/wolong-shenshuping-base",
  );
});

test("publishes only real localized revision summaries from the current release", async ({ page }) => {
  await page.goto("/en");
  const revisions = page.getByTestId("recent-archive-revisions");

  await expect(revisions.getByRole("listitem")).toHaveCount(4);
  await expect(revisions.getByText(/^Last verified:/)).toHaveCount(4);
  await expect(revisions).not.toContainText("Tian Tian");
});

test("keeps canonical and alternate language metadata on the ZhiPanda Home", async ({ page }) => {
  await page.goto("/en");

  await expect(page).toHaveTitle(/ZhiPanda.*Discover the pandas you care about/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.zhipanda.com/en");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "ZhiPanda");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://www.zhipanda.com/en");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "ZhiPanda | Discover the pandas you care about");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
  await expect(page.locator('link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute("href", /\/zh$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", /\/zh$/);
  await expect(page.getByRole("link", { name: "中文", exact: true })).toHaveAttribute("href", "/zh");
});

test("searches the localized Atlas without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en");

  const query = page.getByLabel("Enter a panda name");
  await query.fill("mei xiang");
  await query.press("Enter");

  await expect(page).toHaveURL(/\/en\/pandas\?q=mei(\+|%20)xiang$/);
  await expect(page.getByTestId("localized-pandas-page")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mei Xiang/ })).toHaveAttribute("href", "/en/pandas/mei-xiang");
  await context.close();
});

test("keeps the image-led Home usable at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/zh");

  await expect(page.getByTestId("editorial-home")).toBeVisible();
  await expect(page.getByTestId("home-hero-media-image")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
