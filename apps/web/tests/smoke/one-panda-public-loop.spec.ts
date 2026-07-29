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

test("finds Mei Xiang by every reviewed public identity form", async ({ page }) => {
  for (const query of [
    "美香",
    "Mei Xiang",
    "Měixiāng",
    "Mei-Xiang",
    "meixiang",
    "smithsonian_history_key:mei-xiang",
  ]) {
    await page.goto(`/zh/pandas?q=${encodeURIComponent(query)}`);
    await expect(page.getByTestId("atlas-result-summary"), query).toContainText("共匹配 1 项");
    await expect(page.getByRole("link", { name: /美香.*Mei Xiang/ }), query).toHaveAttribute(
      "href",
      "/zh/pandas/mei-xiang",
    );
  }
});

test("serves bilingual canonical routes and permanently redirects legacy slugs", async ({ request }) => {
  const legacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toContain("/zh/pandas/mei-xiang");

  const englishLegacy = await request.get("/en/pandas/meixiang", { maxRedirects: 0 });
  expect(englishLegacy.status()).toBe(308);
  expect(englishLegacy.headers().location).toContain("/en/pandas/mei-xiang");

  for (const path of ["/zh/pandas/mei-xiang", "/en/pandas/mei-xiang"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text()).toContain("Mei Xiang");
  }

  expect((await request.get("/en/pandas/tian-tian")).status()).toBe(200);
  const tianTianLegacy = await request.get("/en/pandas/tiantian", { maxRedirects: 0 });
  expect(tianTianLegacy.status()).toBe(308);
  expect(tianTianLegacy.headers().location).toContain("/en/pandas/tian-tian");
});

test("renders the reviewed identity, image-led profile, family, footprint, evidence, and revision loop", async ({ page }) => {
  await page.goto("/zh/pandas/mei-xiang");

  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByText("稳定身份")).toBeVisible();
  await expect(page.getByText("完整档案").first()).toBeVisible();
  await expect(page.getByText("最后核实：2026-05-09").first()).toBeVisible();
  await expect(page.getByTestId("fact-life-status")).toContainText("存活");
  await expect(page.getByTestId("fact-life-status")).toContainText("分类值");
  await expect(page.getByTestId("fact-birth")).toContainText("结论状态：已确认");
  await expect(page.getByTestId("fact-birth")).toContainText("精度：日");
  for (const fact of ["fact-birth", "fact-sex", "fact-place"]) {
    await expect(page.getByTestId(fact)).toContainText("来源");
    await expect(page.getByTestId(fact).getByRole("link")).toHaveCount(1);
  }
  await expect(page.getByTestId("fact-parents")).toContainText("暂无已审核来源结论");
  await expect(page.getByTestId("lineage-text-view")).toContainText("小奇迹");
  await expect(page.getByTestId("footprint-text-view")).toContainText("史密森国家动物园");
  await expect(page.getByTestId("footprint-text-view")).toContainText("中国（国家级记录）");
  expect(await page.getByTestId("evidence-list").getByRole("link").count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("profile-hero-media")).toBeVisible();
  await expect(page.locator('[data-testid="profile-hero-media-image"], [data-testid="profile-hero-media-fallback"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="media-gallery"], [data-testid="media-empty-state"]')).toHaveCount(1);
  await expect(page.getByTestId("revision-summary")).toContainText(/2026\.\d{2}\.\d{2}\.\d+/);
  await expect(page.getByTestId("timeline-list")).toContainText("来源发布日期");
});

test("renders partial, tentative, facility, source-link-only, and revision states truthfully", async ({ page }) => {
  await page.goto("/zh/pandas/bei-bei");
  await expect(page.getByTestId("fact-place")).toContainText("中国大熊猫保护研究中心卧龙神树坪基地");
  await expect(page.getByText("当前时间线是已发布子集，不代表完整生平。")).toBeVisible();

  await page.goto("/zh/pandas/bao-li");
  const parentRelations = page.getByTestId("parent-relations");
  await expect(parentRelations).toContainText("An An");
  await expect(parentRelations).toContainText("暂定关系");
  await expect(parentRelations).toContainText("仅有关系依赖记录，暂无完整档案");
  await expect(parentRelations.getByRole("link", { name: "An An" })).toHaveCount(0);

  await page.goto("/zh/pandas/tian-tian");
  await expect(page.getByTestId("media-source-link-state")).toContainText("仅提供来源媒体链接");
  await expect(page.getByTestId("media-source-link-state").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("revision-summary")).toContainText("版本标识可用，但当前语言的修订摘要尚未发布");
  await expect(page.getByTestId("evidence-list")).toContainText("可访问");
});

test("keeps account Follow keyboard operable without creating local saved state", async ({ page }) => {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
  await page.route("**/api/engagement/follow-intents", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        intent_id: "11111111-1111-1111-1111-111111111111",
        panda_id: body.panda_id,
        locale: body.locale,
        safe_return_path: body.return_path,
        status: "pending",
        expires_at: "2026-07-29T10:00:00Z",
      }),
    });
  });
  await page.goto("/zh/pandas/mei-xiang");

  const follow = page.getByRole("button", { name: "关注美香" });
  await expect(follow).toBeEnabled();
  await follow.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fzh%2Fpandas%2Fmei-xiang$/);
  const savedState = await page.evaluate(() => localStorage.getItem("panda-atlas:saved-profiles"));
  expect(savedState).toBeNull();
});

test("exposes the full reading loop to keyboard focus and sequential section navigation", async ({ page, browserName }) => {
  await page.route("**/api/identity/session", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: '{"detail":"Authentication required"}' });
  });
  await page.goto("/zh/pandas/mei-xiang");
  const sectionNavigation = page.getByRole("navigation", { name: "档案章节" });
  const storyLink = sectionNavigation.getByRole("link", { name: "档案摘要" });
  const timelineLink = sectionNavigation.getByRole("link", { name: "时间线" });

  await storyLink.focus();
  if (browserName === "webkit") {
    // Safari/WebKit link traversal depends on a browser-level preference outside the document.
    await timelineLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(timelineLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#timeline$/);

  const readingLoopTargets = [
    page.locator('a[href="/en/pandas/mei-xiang"]:visible').first(),
    page.locator('a[href="/zh/pandas/tai-shan"]:visible').first(),
    page.locator('main a[href^="http"]:visible').first(),
    page.getByRole("button", { name: "关注美香" }),
  ];

  for (const target of readingLoopTargets) {
    await expect(target).toBeVisible();
    await expect(target).toHaveJSProperty("tabIndex", 0);
    await target.focus();
    await expect(target).toBeFocused();
  }
});

test("keeps the server-rendered profile readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh/pandas/mei-xiang");

  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  await expect(page.getByTestId("evidence-list")).toBeVisible();
  await context.close();
});

test("reflows at the effective CSS viewport produced by 200-percent browser zoom", async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "Browser zoom emulation requires Chromium CDP; cross-browser text reflow is covered by accessibility checks.",
  );
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 450,
    screenWidth: 1280,
    screenHeight: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.goto("/zh/pandas/mei-xiang");

  expect(await page.evaluate(() => screen.width / innerWidth)).toBe(2);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
});

test("keeps the complete public loop usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/zh/pandas/mei-xiang");

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByTestId("identity-first-card")).toBeVisible();
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  await expect(page.getByTestId("profile-hero-media")).toBeVisible();
  await expect(page.locator('[data-testid="profile-hero-media-image"], [data-testid="profile-hero-media-fallback"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="media-gallery"], [data-testid="media-empty-state"]')).toHaveCount(1);
});

test("uses the trusted profile theme in dark color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/pandas/mei-xiang");

  const colors = await page.getByTestId("identity-first-card").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(colors.background).toBe("rgb(24, 33, 26)");
  expect(colors.color).toBe("rgb(237, 243, 238)");
});
