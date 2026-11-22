import { expect, test } from "@playwright/test";

for (const { locale, about, title } of [
  { locale: "zh", about: "关于吱熊猫", title: "关于吱熊猫" },
  { locale: "en", about: "About", title: "About ZhiPanda" },
] as const) {
  test(`${locale} about page is linked from the footer and has a canonical URL`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await page.getByRole("contentinfo").getByRole("link", { name: about, exact: true }).click();

    await expect(page).toHaveURL(`/${locale}/about`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@zhipanda.com" })).toHaveAttribute("href", "mailto:hello@zhipanda.com");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.zhipanda.com/${locale}/about`);
  });
}

test("learn index links an article whose term opens the term page", async ({ page }) => {
  await page.goto("/zh/learn");
  await expect(page.getByRole("heading", { level: 1, name: "熊猫科普" })).toBeVisible();
  await page.getByRole("link", { name: /黑眼圈不是熬夜熬的/ }).click();

  await expect(page).toHaveURL("/zh/learn/articles/black-eye-patches");
  await expect(page.getByRole("heading", { level: 1, name: /黑眼圈不是熬夜熬的/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "喜伦" })).toHaveAttribute("href", "/zh/pandas/xi-lun");

  const payload = JSON.parse(await page.getByTestId("learn-article-structured-data").textContent() ?? "{}") as Record<string, unknown>;
  expect(payload["@type"]).toBe("Article");
  expect(payload.url).toBe("https://www.zhipanda.com/zh/learn/articles/black-eye-patches");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);

  await page.getByRole("main").getByRole("link", { name: "黑眼圈", exact: true }).click();
  await expect(page).toHaveURL("/zh/learn/terms/eye-patch");
  await expect(page.getByRole("heading", { level: 1, name: "黑眼圈" })).toBeVisible();
  await expect(page.getByRole("link", { name: /黑眼圈不是熬夜熬的/ })).toBeVisible();
});

test("English learn shows English terms and sends Chinese-only articles to the Chinese page", async ({ page, request }) => {
  await page.goto("/en/learn");
  await expect(page.getByRole("link", { name: "Eye patches" })).toHaveAttribute("href", "/en/learn/terms/eye-patch");
  await expect(page.getByRole("link", { name: /黑眼圈不是熬夜熬的/ })).toHaveAttribute("href", "/zh/learn/articles/black-eye-patches");
  expect((await request.get("/en/learn/articles/black-eye-patches")).status()).toBe(404);

  await page.goto("/en/learn/terms/eye-patch");
  await expect(page.getByRole("heading", { level: 1, name: "Eye patches" })).toBeVisible();
});

test("Chinese-only terms have no English page and are linked in Chinese from English learn", async ({ page, request }) => {
  await page.goto("/en/learn");
  const saddle = page.getByRole("link", { name: "背带" });
  await expect(saddle).toHaveAttribute("href", "/zh/learn/terms/saddle");
  await expect(page.locator("li", { has: saddle })).toHaveAttribute("lang", "zh-CN");
  expect((await request.get("/en/learn/terms/saddle")).status()).toBe(404);

  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/zh/learn/terms/saddle<");
  expect(xml).not.toContain("/en/learn/terms/saddle<");
});

test("a term used in two paragraphs gets distinct tooltip ids", async ({ page }) => {
  await page.goto("/zh/learn/articles/black-eye-patches");
  const ids = await page.locator("main a[aria-describedby]").evaluateAll((links) => links.map((link) => link.getAttribute("aria-describedby")));
  expect(ids.length).toBeGreaterThanOrEqual(3);
  expect(new Set(ids).size).toBe(ids.length);
});

test("sitemap lists about, app, learn pages, and articles only in their own language", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/zh/about", "/en/about", "/zh/app", "/zh/learn", "/en/learn", "/zh/learn/articles/black-eye-patches", "/en/learn/terms/eye-patch"]) {
    expect(xml).toContain(`${path}<`);
  }
  expect(xml).not.toContain("/en/learn/articles/");
});

test("without store links the app page says it is coming and detail pages show no app bar", async ({ page }) => {
  await page.goto("/zh/app");
  await expect(page.getByTestId("app-coming-soon")).toContainText("App 即将上架");
  await expect(page.getByTestId("app-download-links")).toHaveCount(0);

  await page.goto("/zh/pandas/xi-lun");
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("open-in-app-bar")).toHaveCount(0);
});

test("pages without their own photo share the default image", async ({ page }) => {
  await page.goto("/zh/about");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://www.zhipanda.com/og-default.png");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});
