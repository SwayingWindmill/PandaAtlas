import { expect, test } from "@playwright/test";

test("completes the localized search-to-profile trust spine", async ({ page }) => {
  await page.goto("/zh");

  await expect(page.getByRole("heading", { level: 1, name: /可信的大熊猫公开档案/ })).toBeVisible();
  const search = page.getByRole("search", { name: "搜索公开档案" });
  await search.getByLabel("熊猫名称或公开标识").fill("美香");
  await search.getByRole("button", { name: "搜索" }).click();

  await expect(page).toHaveURL(/\/zh\/atlas\?q=%E7%BE%8E%E9%A6%99$/);
  await expect(page.getByRole("heading", { level: 1, name: "熊猫档案检索" })).toBeVisible();
  await expect(page.getByTestId("atlas-result-summary")).toContainText("共匹配 1 项");
  await expect(page.getByTestId("public-delivery-notice")).toContainText("缓存的可信发布版本");

  const result = page.getByRole("link", { name: /美香.*Mei Xiang/ });
  await expect(result).toHaveAttribute("href", "/zh/atlas/mei-xiang");
  await expect(result).toContainText("存活");
  await expect(result).toContainText("中国（国家级记录）");
  await result.click();

  await expect(page).toHaveURL(/\/zh\/atlas\/mei-xiang$/);
  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByTestId("public-delivery-notice")).toContainText("2026.07.14.3");
  await expect(page.getByTestId("fact-birth")).toContainText("来源");
});

test("uses the same reviewed identity release in English", async ({ page }) => {
  await page.goto("/en/atlas?q=Mei%20Xiang");

  await expect(page.getByRole("heading", { level: 1, name: "Panda profile discovery" })).toBeVisible();
  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 matches");
  await expect(page.getByRole("link", { name: /Mei Xiang.*美香/ })).toHaveAttribute(
    "href",
    "/en/atlas/mei-xiang",
  );
  await expect(page.getByText("He Hua")).toHaveCount(0);
});

test("resolves unprefixed routes from the request language and preserves task state", async ({ request }) => {
  const root = await request.get("/", {
    headers: { "accept-language": "en-US,en;q=0.9,zh;q=0.5" },
    maxRedirects: 0,
  });
  expect(root.status()).toBe(308);
  expect(root.headers().location).toContain("/en");

  const atlas = await request.get("/atlas?q=%E7%BE%8E%E9%A6%99", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(atlas.status()).toBe(308);
  expect(atlas.headers().location).toContain("/en/atlas?q=%E7%BE%8E%E9%A6%99");

  const profile = await request.get("/atlas/meixiang?from=legacy", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(profile.status()).toBe(308);
  expect(profile.headers().location).toContain("/en/atlas/mei-xiang?from=legacy");
});

test("never renders the generated legacy profile as a rollback", async ({ request }) => {
  const untrustedLegacy = await request.get("/atlas/he-hua", { maxRedirects: 0 });
  expect(untrustedLegacy.status()).toBe(404);

  const malformedLegacy = await request.get("/atlas/%E0%A4%A", { maxRedirects: 0 });
  expect(malformedLegacy.status()).not.toBe(500);

  const reviewedLegacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(reviewedLegacy.status()).toBe(308);
  expect(reviewedLegacy.headers().location).toContain("/zh/atlas/mei-xiang");

  const localizedLegacy = await request.get("/en/atlas/meixiang?from=old-link", { maxRedirects: 0 });
  expect(localizedLegacy.status()).toBe(308);
  expect(localizedLegacy.headers().location).toContain("/en/atlas/mei-xiang?from=old-link");
});

test("marks identity-first profiles as partial rather than complete", async ({ page }) => {
  await page.goto("/zh/atlas/tai-shan");

  await expect(page.getByTestId("public-delivery-notice")).toContainText("当前任务范围部分可用");
  await expect(page.getByText("基础资料").first()).toBeVisible();
  await expect(page.getByTestId("fact-life-status")).toBeVisible();
});

test("keeps the localized navigation task-complete on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh");

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.focus();
  await page.keyboard.press("Enter");

  const mobileNavigation = page.getByRole("navigation", { name: "移动导航" });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "熊猫档案" })).toHaveAttribute("href", "/zh/atlas");
  await expect(mobileNavigation.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en");

  await page.keyboard.press("Escape");
  await expect(mobileNavigation).toBeHidden();
  await expect(menuButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
